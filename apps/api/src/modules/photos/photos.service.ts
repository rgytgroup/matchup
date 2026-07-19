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

    try {
      const signed = await this.storage.signUrls(submission.photoUrls, 3600);

      // 1. Empaquetar las fotos en un .zip y subirlo (los trainers piden un zip).
      const zipBuffer = await this.buildZip(signed);
      const zipPath = `training/${orderId}.zip`;
      await this.storage.uploadBytes(zipPath, zipBuffer, 'application/zip');
      const [zipUrl] = await this.storage.signUrls([zipPath], 3600);

      // 2. Entrenar el LoRA.
      const { trainingId } = await this.provider.train(zipUrl);
      await this.prisma.photoJob.update({ where: { id: job.id }, data: { trainingId } });
      await this.events.record('photos.training_started', { orderId, trainingId });

      // 3. Esperar a que termine el entrenamiento (asíncrono, minutos).
      const modelVersion = await this.waitForTraining(trainingId);
      await this.prisma.photoJob.update({ where: { id: job.id }, data: { status: 'GENERATING' } });

      // 4. Generar imágenes por escenario (plantillas de /prompts/photo-scenarios.md).
      const scenarios = this.parseScenarios(this.prompts.load('photo-scenarios'));
      const outputs: string[] = [];
      for (const prompt of scenarios) {
        const urls = await this.provider.generate(modelVersion, prompt);
        outputs.push(...urls);
      }
      await this.prisma.photoJob.update({
        where: { id: job.id },
        data: { outputUrls: outputs, status: 'QC' },
      });

      // 5. QC de parecido facial vs la primera foto original; quedarse con las mejores.
      const reference = signed[0];
      const accepted: string[] = [];
      for (const url of outputs) {
        const score = await this.analysis.scoreSimilarity(reference, url);
        if (score >= QC_THRESHOLD) accepted.push(url);
      }
      const finalAccepted = accepted.slice(0, TARGET_PHOTOS);

      await this.prisma.photoJob.update({
        where: { id: job.id },
        data: { acceptedUrls: finalAccepted, status: 'DONE' },
      });
      await this.events.record('photos.done', {
        orderId,
        generated: outputs.length,
        accepted: finalAccepted.length,
      });

      if (finalAccepted.length < MIN_ACCEPTABLE) {
        // TODO(SPEC §6.4): regenerar una tanda; si sigue mal, alertar al admin para revisión manual.
        await this.events.record('photos.low_quality', {
          orderId,
          accepted: finalAccepted.length,
        });
        this.logger.warn(`PhotoJob ${orderId}: solo ${finalAccepted.length} fotos aceptables (<${MIN_ACCEPTABLE}).`);
      }
    } catch (err) {
      await this.prisma.photoJob.update({ where: { id: job.id }, data: { status: 'FAILED' } });
      await this.events.record('photos.failed', { orderId, error: (err as Error).message });
      this.logger.error(`PhotoJob FAILED (orden ${orderId}): ${(err as Error).message}`);
    }
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
