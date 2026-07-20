import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import sharp from 'sharp';
import { isPlatform, type TierId } from '@matchup/shared';
import { EventsService } from '../../common/events/events.service';
import { StorageService, type UploadableFile } from '../../storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EXTRACTION_QUEUE } from '../../queue/queue.constants';
import { OrdersService } from '../orders/orders.service';
import { AnalysisService } from '../analysis/analysis.service';
import type { ExtractedProfile } from '../analysis/extraction.types';

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

    await this.prisma.submission.update({
      where: { id: submission.id },
      data: {
        platform,
        bioText: composedBio,
        questionnaire: (data.questionnaire ?? submission.questionnaire ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.events.record('extraction.confirmed', { orderId });
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

      const photoPaths = await this.cropPhotos(orderId, submission.screenshotUrls, extracted.photoCrops);
      const platform = extracted.platform === 'unknown' ? 'other' : extracted.platform;

      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          extractedProfile: extracted as unknown as Prisma.InputJsonValue,
          platform,
          bioText: extracted.bioText,
          photoUrls: photoPaths,
          status: 'CONFIRMING',
        },
      });
      await this.events.record('extraction.done', {
        orderId,
        confidence: extracted.confidence,
        photos: photoPaths.length,
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

  /** Recorta cada foto del perfil desde su screenshot (bounding box normalizado 0–1). */
  private async cropPhotos(
    orderId: string,
    screenshotPaths: string[],
    crops: ExtractedProfile['photoCrops'],
  ): Promise<string[]> {
    const signed = await this.storage.signUrls(screenshotPaths, 3600);
    const out: string[] = [];
    for (let i = 0; i < crops.length; i += 1) {
      const crop = crops[i];
      const url = signed[crop.screenshotIndex];
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buffer = Buffer.from(await res.arrayBuffer());
        const meta = await sharp(buffer).metadata();
        const W = meta.width ?? 0;
        const H = meta.height ?? 0;
        if (!W || !H) continue;

        const [x, y, w, h] = crop.boundingBox;
        const left = Math.min(Math.max(0, Math.round(x * W)), W - 1);
        const top = Math.min(Math.max(0, Math.round(y * H)), H - 1);
        const width = Math.max(1, Math.min(Math.round(w * W), W - left));
        const height = Math.max(1, Math.min(Math.round(h * H), H - top));

        const cropped = await sharp(buffer)
          .extract({ left, top, width, height })
          .jpeg({ quality: 90 })
          .toBuffer();
        out.push(await this.storage.uploadBytes(`orders/${orderId}/${i}.jpg`, cropped, 'image/jpeg'));
      } catch (e) {
        this.logger.warn(`Recorte ${i} falló (${orderId}): ${(e as Error).message}`);
      }
    }
    return out;
  }
}
