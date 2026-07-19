import { Inject, Injectable, Logger } from '@nestjs/common';
import JSZip from 'jszip';
import { EventsService } from '../../common/events/events.service';
import { PromptLoaderService } from '../../prompts/prompt-loader.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AnalysisService } from '../analysis/analysis.service';
import { PHOTO_PROVIDER, TRIGGER_WORD, type PhotoProvider } from './photo-provider.interface';

const QC_THRESHOLD = 70; // parecido mínimo (0-100) para aceptar una foto
const TARGET_PHOTOS = 30; // cuántas entregar (SPEC §1)
const MIN_ACCEPTABLE = 20; // por debajo de esto, regenerar/alertar (SPEC §6.4)
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 160; // ~40 min
const GEN_SPACING_MS = 2_000; // pausa entre generaciones (gentil con el rate limit)

/** Pipeline de fotos del tier premium (SPEC §6). */
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
  ) {}

  /** Pipeline completo: zip → entrenar → esperar → generar → QC. */
  async startJob(orderId: string): Promise<void> {
    const submission = await this.prisma.submission.findUnique({ where: { orderId } });
    if (!submission) {
      this.logger.warn(`startJob: sin submission para la orden ${orderId}`);
      return;
    }

    const job = await this.prisma.photoJob.upsert({
      where: { orderId },
      update: { status: 'TRAINING' },
      create: { orderId, provider: 'replicate', status: 'TRAINING', outputUrls: [], acceptedUrls: [] },
    });

    let modelVersion: string;
    try {
      const signed = await this.storage.signUrls(submission.photoUrls, 3600);
      const zipBuffer = await this.buildZip(signed);
      const zipPath = `training/${orderId}.zip`;
      await this.storage.uploadBytes(zipPath, zipBuffer, 'application/zip');
      const [zipUrl] = await this.storage.signUrls([zipPath], 3600);

      const { trainingId } = await this.provider.train(zipUrl);
      await this.prisma.photoJob.update({ where: { id: job.id }, data: { trainingId } });
      await this.events.record('photos.training_started', { orderId, trainingId });

      modelVersion = await this.waitForTraining(trainingId);
    } catch (err) {
      await this.failJob(job.id, orderId, err, 'entrenamiento');
      return;
    }

    await this.runGeneration(orderId, job.id, modelVersion);
  }

  /**
   * Reanuda solo la generación + QC con un modelo YA entrenado (sin re-entrenar).
   * Útil cuando el entrenamiento salió bien pero la generación falló (p. ej. rate limit).
   */
  async resumeGeneration(orderId: string, modelVersion: string): Promise<void> {
    const job = await this.prisma.photoJob.upsert({
      where: { orderId },
      update: { status: 'GENERATING' },
      create: {
        orderId,
        provider: 'replicate',
        status: 'GENERATING',
        outputUrls: [],
        acceptedUrls: [],
      },
    });
    await this.runGeneration(orderId, job.id, modelVersion);
  }

  private async runGeneration(orderId: string, jobId: string, modelVersion: string): Promise<void> {
    try {
      const submission = await this.prisma.submission.findUnique({ where: { orderId } });
      if (!submission) throw new Error(`sin submission para ${orderId}`);
      const signed = await this.storage.signUrls(submission.photoUrls, 3600);

      await this.prisma.photoJob.update({ where: { id: jobId }, data: { status: 'GENERATING' } });

      const scenarios = this.parseScenarios(this.prompts.load('photo-scenarios'));
      const outputs: string[] = [];
      for (const prompt of scenarios) {
        const urls = await this.provider.generate(modelVersion, prompt);
        outputs.push(...urls);
        await this.sleep(GEN_SPACING_MS);
      }
      await this.prisma.photoJob.update({
        where: { id: jobId },
        data: { outputUrls: outputs, status: 'QC' },
      });

      // QC de parecido facial vs la primera foto original; quedarse con las mejores.
      const reference = signed[0];
      const accepted: string[] = [];
      for (const url of outputs) {
        const score = await this.analysis.scoreSimilarity(reference, url);
        if (score >= QC_THRESHOLD) accepted.push(url);
      }
      const finalAccepted = accepted.slice(0, TARGET_PHOTOS);

      // Persistir en Supabase: las URLs de Replicate son temporales (~1h).
      const persisted: string[] = [];
      for (let i = 0; i < finalAccepted.length; i += 1) {
        try {
          const path = await this.storage.uploadFromUrl(
            `orders/${orderId}/generated/${i}.jpg`,
            finalAccepted[i],
          );
          persisted.push(path);
        } catch (e) {
          this.logger.warn(`No se pudo persistir la foto ${i} (${orderId}): ${(e as Error).message}`);
        }
      }

      await this.prisma.photoJob.update({
        where: { id: jobId },
        data: { acceptedUrls: persisted, status: 'DONE' },
      });
      await this.events.record('photos.done', {
        orderId,
        generated: outputs.length,
        accepted: persisted.length,
      });

      if (persisted.length < MIN_ACCEPTABLE) {
        // TODO(SPEC §6.4): regenerar una tanda; si sigue mal, alertar al admin.
        await this.events.record('photos.low_quality', { orderId, accepted: persisted.length });
        this.logger.warn(`PhotoJob ${orderId}: solo ${persisted.length} fotos aceptables (<${MIN_ACCEPTABLE}).`);
      }
    } catch (err) {
      await this.failJob(jobId, orderId, err, 'generación');
    }
  }

  private async failJob(jobId: string, orderId: string, err: unknown, fase: string): Promise<void> {
    await this.prisma.photoJob.update({ where: { id: jobId }, data: { status: 'FAILED' } });
    await this.events.record('photos.failed', { orderId, fase, error: (err as Error).message });
    this.logger.error(`PhotoJob FAILED en ${fase} (orden ${orderId}): ${(err as Error).message}`);
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
