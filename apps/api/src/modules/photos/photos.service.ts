import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import JSZip from 'jszip';
import { PHOTOS_QUEUE } from '../../queue/queue.constants';
import { EventsService } from '../../common/events/events.service';
import { EmailService } from '../../notifications/email.service';
import { PromptLoaderService } from '../../prompts/prompt-loader.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { isTransientError, MAX_PIPELINE_ATTEMPTS, RETRY_BACKOFF_MS } from '../../common/retry.util';
import { AnalysisService } from '../analysis/analysis.service';
import { PHOTO_PROVIDER, TRIGGER_WORD, type PhotoProvider } from './photo-provider.interface';

const QC_THRESHOLD_DEFAULT = 70; // parecido mínimo (0-100) para aceptar una foto
const TARGET_PHOTOS = 30; // cuántas entregar (SPEC §1)
const MIN_ACCEPTABLE = 20; // por debajo de esto, regenerar/alertar (SPEC §6.4)
const MAX_GEN_ROUNDS = 2; // tandas de generación (1 inicial + 1 regeneración si quedan pocas)
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 160; // ~40 min
const GEN_SPACING_MS = 2_000; // pausa entre generaciones (gentil con el rate limit)

/** Pipeline de fotos del tier premium (SPEC §6). Recuperación de fallos: SPEC §11. */
@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    @Inject(PHOTO_PROVIDER) private readonly provider: PhotoProvider,
    private readonly prompts: PromptLoaderService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly analysis: AnalysisService,
    private readonly events: EventsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    @InjectQueue(PHOTOS_QUEUE) private readonly queue: Queue,
  ) {}

  /** Encola el job de fotos en la cola durable con reintentos + backoff (SPEC §11.3). */
  async enqueue(orderId: string): Promise<void> {
    const jobId = `photos-${orderId}`;
    await this.queue.remove(jobId).catch(() => undefined);
    await this.queue.add(
      'generate',
      { orderId },
      {
        jobId,
        attempts: MAX_PIPELINE_ATTEMPTS,
        backoff: { type: 'exponential', delay: RETRY_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  /**
   * Pipeline completo: zip → entrenar → esperar → generar → QC.
   * Reanudable (SPEC §11.2): si ya hay un entrenamiento (en curso o terminado), NO re-entrena
   * (lo caro); la generación reanuda desde las fotos ya aceptadas y persistidas.
   */
  async startJob(orderId: string, isLastAttempt = true): Promise<void> {
    const submission = await this.prisma.submission.findUnique({ where: { orderId } });
    if (!submission) {
      this.logger.warn(`startJob: sin submission para la orden ${orderId}`);
      return;
    }

    const job = await this.prisma.photoJob.upsert({
      where: { orderId },
      update: {},
      create: { orderId, provider: 'replicate', status: 'TRAINING', outputUrls: [], acceptedUrls: [] },
    });
    if (job.status === 'DONE') return; // ya completado

    let modelVersion: string;
    try {
      if (job.trainingId) {
        const st = await this.provider.getTrainingStatus(job.trainingId);
        if (st.status === 'succeeded' && st.modelVersion) {
          modelVersion = st.modelVersion; // reanudar en la generación
        } else if (st.status === 'failed' || st.status === 'canceled') {
          modelVersion = await this.trainAndWait(orderId, job.id, submission.photoUrls);
        } else {
          modelVersion = await this.waitForTraining(job.trainingId); // esperar sin re-entrenar
        }
      } else {
        modelVersion = await this.trainAndWait(orderId, job.id, submission.photoUrls);
      }
    } catch (err) {
      await this.handleFailure(job.id, orderId, err, isLastAttempt, 'entrenamiento');
      return;
    }

    await this.runGeneration(orderId, job.id, modelVersion, isLastAttempt);
  }

  private async trainAndWait(orderId: string, jobId: string, photoUrls: string[]): Promise<string> {
    await this.prisma.photoJob.update({ where: { id: jobId }, data: { status: 'TRAINING' } });
    const signed = await this.storage.signUrls(photoUrls, 3600);
    const zipBuffer = await this.buildZip(signed);
    const zipPath = `training/${orderId}.zip`;
    await this.storage.uploadBytes(zipPath, zipBuffer, 'application/zip');
    const [zipUrl] = await this.storage.signUrls([zipPath], 3600);

    const { trainingId } = await this.provider.train(zipUrl);
    await this.prisma.photoJob.update({ where: { id: jobId }, data: { trainingId } });
    await this.events.record('photos.training_started', { orderId, trainingId });
    return this.waitForTraining(trainingId);
  }

  /** Reanuda solo la generación + QC con un modelo YA entrenado (sin re-entrenar). */
  async resumeGeneration(orderId: string, modelVersion: string, isLastAttempt = true): Promise<void> {
    const job = await this.prisma.photoJob.upsert({
      where: { orderId },
      update: { status: 'GENERATING' },
      create: { orderId, provider: 'replicate', status: 'GENERATING', outputUrls: [], acceptedUrls: [] },
    });
    await this.runGeneration(orderId, job.id, modelVersion, isLastAttempt);
  }

  private async runGeneration(
    orderId: string,
    jobId: string,
    modelVersion: string,
    isLastAttempt: boolean,
  ): Promise<void> {
    try {
      const job = await this.prisma.photoJob.findUnique({ where: { id: jobId } });
      const submission = await this.prisma.submission.findUnique({ where: { orderId } });
      if (!submission) throw new Error(`sin submission para ${orderId}`);
      const signed = await this.storage.signUrls(submission.photoUrls, 3600);
      const reference = signed[0];
      const threshold = this.config.get<number>('PHOTO_QC_THRESHOLD') ?? QC_THRESHOLD_DEFAULT;

      await this.prisma.photoJob.update({ where: { id: jobId }, data: { status: 'GENERATING' } });

      const scenarios = this.parseScenarios(this.prompts.load('photo-scenarios'));
      // Reanudación (SPEC §11.2): partimos de lo YA aceptado y persistido (URLs durables).
      const persisted: string[] = [...(job?.acceptedUrls ?? [])];
      const allOutputs: string[] = [...(job?.outputUrls ?? [])];
      const scored = new Set<string>(Array.isArray(job?.qcScoredUrls) ? (job!.qcScoredUrls as string[]) : []);

      if (persisted.length >= TARGET_PHOTOS) {
        await this.finishGeneration(jobId, orderId, persisted, allOutputs);
        return;
      }

      for (let round = 0; round < MAX_GEN_ROUNDS && persisted.length < TARGET_PHOTOS; round += 1) {
        for (const prompt of scenarios) {
          if (persisted.length >= TARGET_PHOTOS) break;
          const urls = await this.provider.generate(modelVersion, prompt);
          allOutputs.push(...urls);
          for (const url of urls) {
            if (persisted.length >= TARGET_PHOTOS) break;
            if (scored.has(url)) continue;
            const score = await this.analysis.scoreSimilarity(reference, url);
            scored.add(url);
            if (score >= threshold) {
              try {
                // Persistir de inmediato (Supabase, durable) para poder reanudar sin re-generar.
                const p = await this.storage.uploadFromUrl(
                  `orders/${orderId}/generated/${persisted.length}.jpg`,
                  url,
                );
                persisted.push(p);
                await this.prisma.photoJob.update({
                  where: { id: jobId },
                  data: { acceptedUrls: persisted, outputUrls: allOutputs, qcScoredUrls: [...scored], status: 'QC' },
                });
              } catch (e) {
                this.logger.warn(`No se pudo persistir una foto (${orderId}): ${(e as Error).message}`);
              }
            }
          }
          await this.sleep(GEN_SPACING_MS);
        }
        if (persisted.length >= MIN_ACCEPTABLE) break;
      }

      await this.finishGeneration(jobId, orderId, persisted, allOutputs);
    } catch (err) {
      await this.handleFailure(jobId, orderId, err, isLastAttempt, 'generación');
    }
  }

  private async finishGeneration(
    jobId: string,
    orderId: string,
    persisted: string[],
    allOutputs: string[],
  ): Promise<void> {
    const accepted = persisted.slice(0, TARGET_PHOTOS);
    await this.prisma.photoJob.update({
      where: { id: jobId },
      data: { acceptedUrls: accepted, outputUrls: allOutputs, status: 'DONE' },
    });
    await this.events.record('photos.done', { orderId, generated: allOutputs.length, accepted: accepted.length });

    if (accepted.length < MIN_ACCEPTABLE) {
      await this.events.record('photos.low_quality', { orderId, accepted: accepted.length });
      this.logger.warn(`PhotoJob ${orderId}: solo ${accepted.length} fotos aceptables (<${MIN_ACCEPTABLE}).`);
      await this.email
        .alertAdmin(
          `Truly: fotos de baja calidad (${orderId})`,
          `Solo ${accepted.length} fotos superaron el QC (<${MIN_ACCEPTABLE}) tras ${MAX_GEN_ROUNDS} tandas. Requiere revisión manual (SPEC §6.4).`,
        )
        .catch(() => undefined);
    } else {
      await this.notifyPhotosReady(orderId, accepted.length);
    }
  }

  /** Email al usuario cuando sus fotos IA están listas (link al reporte). */
  private async notifyPhotosReady(orderId: string, count: number): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, submission: { include: { report: true } } },
    });
    const slug = order?.submission?.report?.publicSlug;
    const email = order?.user.email;
    if (!slug || !email) return;

    const reportUrl = `${this.config.get<string>('APP_BASE_URL')}/report/${slug}`;
    await this.email
      .sendPhotosReady(email, reportUrl)
      .catch((e) =>
        this.logger.warn(`No se pudo enviar email de fotos listas (${orderId}): ${(e as Error).message}`),
      );
    await this.events.record('photos.email_sent', { orderId, count });
  }

  /** Reintento (transitorio + quedan intentos) o NEEDS_ATTENTION (agotado/estructural). SPEC §11.3. */
  private async handleFailure(
    jobId: string,
    orderId: string,
    err: unknown,
    isLastAttempt: boolean,
    fase: string,
  ): Promise<void> {
    const message = (err as Error).message ?? String(err);
    await this.prisma.photoJob.update({
      where: { id: jobId },
      data: { retryCount: { increment: 1 }, lastError: message.slice(0, 1000) },
    });
    Sentry.captureException(err, { extra: { orderId, phase: `photos:${fase}` } });

    if (isTransientError(err) && !isLastAttempt) {
      this.logger.warn(`Fotos transitorio (${fase}, orden ${orderId}), reintentará: ${message}`);
      throw err; // BullMQ reintenta; el entrenamiento/generación reanudan (§11.2).
    }

    await this.prisma.photoJob.update({ where: { id: jobId }, data: { status: 'NEEDS_ATTENTION' } });
    await this.events.record('photos.needs_attention', { orderId, fase, error: message });
    this.logger.error(`PhotoJob NEEDS_ATTENTION en ${fase} (orden ${orderId}): ${message}`);
    await this.email
      .alertAdmin(
        `Truly: fotos requieren atención (${orderId})`,
        `Fase: ${fase} · tras ${MAX_PIPELINE_ATTEMPTS} intentos\n${(err as Error).stack ?? message}`,
      )
      .catch(() => undefined);
  }

  /** Detiene el job de fotos activo (tras un reembolso): cancela el training y marca FAILED. */
  async cancelJob(orderId: string): Promise<void> {
    const job = await this.prisma.photoJob.findUnique({ where: { orderId } });
    if (!job) return;
    if (!['TRAINING', 'GENERATING', 'QC', 'NEEDS_ATTENTION'].includes(job.status)) return;

    if (job.trainingId) {
      try {
        await this.provider.cancelTraining(job.trainingId);
      } catch (e) {
        this.logger.warn(`cancelTraining falló (${orderId}): ${(e as Error).message}`);
      }
    }
    await this.prisma.photoJob.update({ where: { id: job.id }, data: { status: 'FAILED' } });
    await this.events.record('photos.canceled', { orderId });
  }

  private async waitForTraining(trainingId: string): Promise<string> {
    for (let i = 0; i < MAX_POLLS; i += 1) {
      const { status, modelVersion } = await this.provider.getTrainingStatus(trainingId);
      if (status === 'succeeded') {
        if (!modelVersion) throw new Error('Entrenamiento OK pero sin modelVersion en el output');
        return modelVersion;
      }
      if (status === 'failed' || status === 'canceled') {
        throw new Error(`Entrenamiento ${status}`);
      }
      await this.sleep(POLL_INTERVAL_MS);
    }
    throw new Error('Timeout esperando el entrenamiento');
  }

  private async buildZip(photoUrls: string[]): Promise<Buffer> {
    const zip = new JSZip();
    for (let i = 0; i < photoUrls.length; i += 1) {
      const res = await fetch(photoUrls[i]);
      if (!res.ok) throw new Error(`No se pudo descargar la foto ${i} para el zip (HTTP ${res.status})`);
      const contentType = res.headers.get('content-type') ?? 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      zip.file(`img_${i}.${ext}`, Buffer.from(await res.arrayBuffer()));
    }
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  /** Extrae los prompts con {{subject}} de photo-scenarios.md y pone el trigger word. */
  private parseScenarios(md: string): string[] {
    const prompts: string[] = [];
    const re = /`([^`]+)`/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(md)) !== null) {
      if (match[1].includes('{{subject}}')) {
        prompts.push(match[1].replace(/\{\{subject\}\}/g, TRIGGER_WORD));
      }
    }
    return prompts;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
