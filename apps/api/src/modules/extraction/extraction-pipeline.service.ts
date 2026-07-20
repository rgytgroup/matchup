import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { isPlatform, type TierId } from '@matchup/shared';
import { EventsService } from '../../common/events/events.service';
import { StorageService, type UploadableFile } from '../../storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EXTRACTION_QUEUE } from '../../queue/queue.constants';
import { OrdersService } from '../orders/orders.service';
import { AnalysisService } from '../analysis/analysis.service';

const MIN_CONFIDENCE = 0.7; // SPEC §5.0.3

/**
 * Pipeline de extracción screenshot-first (SPEC §5.0), PRE-pago.
 * Sube screenshots → Gemini extrae perfil → recorta las fotos → deja la
 * submission en CONFIRMING para la pantalla de confirmación (o fallback a manual).
 */
@Injectable()
export class ExtractionPipelineService {
  private readonly logger = new Logger(ExtractionPipelineService.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly analysis: AnalysisService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    @InjectQueue(EXTRACTION_QUEUE) private readonly queue: Queue,
  ) {}

  /** Crea orden + submission (SCREENSHOTS/EXTRACTING), sube screenshots y encola. */
  async startExtraction(
    email: string,
    tier: TierId,
    screenshots: UploadableFile[],
  ): Promise<{ orderId: string }> {
    const order = await this.orders.createPending(email, tier);
    const submission = await this.prisma.submission.create({
      data: {
        orderId: order.id,
        intakeMode: 'SCREENSHOTS',
        status: 'EXTRACTING',
        questionnaire: {},
        bioText: '',
        photoUrls: [],
      },
    });
    const paths = await this.storage.uploadScreenshots(order.id, screenshots);
    await this.prisma.submission.update({
      where: { id: submission.id },
      data: { screenshotUrls: paths },
    });
    await this.queue.add('extract', { orderId: order.id }, { attempts: 2, jobId: `extract-${order.id}` });
    await this.events.record('extraction.enqueued', { orderId: order.id, screenshots: paths.length });
    return { orderId: order.id };
  }

  /** Confirmación editable: lo que confirma/corrige el usuario es la fuente de verdad. */
  async confirm(
    orderId: string,
    data: {
      platform?: string;
      bioText?: string;
      prompts?: Array<{ prompt: string; answer: string }>;
      questionnaire?: unknown;
    },
    photos: UploadableFile[],
  ): Promise<{ ok: boolean }> {
    const submission = await this.prisma.submission.findUnique({ where: { orderId } });
    if (!submission) return { ok: false };

    const platform =
      data.platform && isPlatform(data.platform) ? data.platform : (submission.platform ?? 'other');
    const prompts = data.prompts ?? [];
    // El análisis recibe bio + prompts juntos como bioText.
    const composedBio = [data.bioText ?? submission.bioText, ...prompts.map((p) => `${p.prompt}: ${p.answer}`)]
      .filter(Boolean)
      .join('\n');
    // Enfoque híbrido: el usuario sube sus fotos ORIGINALES (alta resolución).
    const photoUrls = await this.storage.uploadPhotos(orderId, photos);

    await this.prisma.submission.update({
      where: { id: submission.id },
      data: {
        platform,
        bioText: composedBio,
        photoUrls,
        questionnaire: (data.questionnaire ?? submission.questionnaire ?? {}) as Prisma.InputJsonValue,
        status: 'CONFIRMING',
      },
    });
    await this.events.record('extraction.confirmed', { orderId, photos: photoUrls.length });
    return { ok: true };
  }

  /** Worker: corre la extracción, aplica guardrail, recorta fotos y deja CONFIRMING. */
  async process(orderId: string): Promise<void> {
    const submission = await this.prisma.submission.findUnique({ where: { orderId } });
    if (!submission) return;

    try {
      const signed = await this.storage.signUrls(submission.screenshotUrls, 3600);
      const extracted = await this.analysis.extractFromScreenshots(signed);

      // Guardrail (SPEC §5.0.6): nunca analizar perfiles ajenos.
      if (!extracted.isOwnProfile) {
        await this.finishFailed(submission.id, orderId, 'third_party');
        return;
      }

      // Enfoque híbrido: NO recortamos fotos del screenshot (imprecisas + baja calidad).
      // El usuario sube sus fotos originales en la confirmación (mejor para audit y LoRA).
      const platform = extracted.platform === 'unknown' ? 'other' : extracted.platform;
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          extractedProfile: extracted as unknown as Prisma.InputJsonValue,
          platform,
          bioText: extracted.bioText,
          status: 'CONFIRMING',
        },
      });
      await this.events.record('extraction.done', {
        orderId,
        confidence: extracted.confidence,
        photoCount: extracted.photoCount,
        lowConfidence: extracted.confidence < MIN_CONFIDENCE,
      });
    } catch (err) {
      Sentry.captureException(err, { extra: { orderId, phase: 'extraction' } });
      await this.finishFailed(submission.id, orderId, 'extraction_error', (err as Error).message);
      this.logger.error(`Extracción FAILED (orden ${orderId}): ${(err as Error).message}`);
    }
  }

  private async finishFailed(
    submissionId: string,
    orderId: string,
    reason: string,
    message?: string,
  ): Promise<void> {
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'FAILED', extractedProfile: { reason, message } as Prisma.InputJsonValue },
    });
    await this.events.record('extraction.rejected', { orderId, reason });
  }
}
