import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../common/events/events.service';
import { AnalysisPipelineService } from '../analysis/analysis-pipeline.service';
import { PhotosService } from '../photos/photos.service';

const RETRYABLE = ['FAILED', 'NEEDS_ATTENTION'];

/**
 * Recuperación asistida de órdenes PAID que fallaron (SPEC §11.4).
 * Re-encola de forma idempotente lo que falte (análisis y/o fotos), sin re-cobro
 * y sin re-entrenar el LoRA (la reanudación vive en cada pipeline, §11.2).
 */
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysisPipeline: AnalysisPipelineService,
    private readonly photos: PhotosService,
    private readonly events: EventsService,
  ) {}

  /**
   * @param opts.admin  marca el evento como disparado por el dueño.
   * @param opts.force  re-encola aunque no esté en estado de fallo (herramienta de admin).
   */
  async retry(
    orderId: string,
    opts: { admin?: boolean; force?: boolean } = {},
  ): Promise<{ ok: boolean; actions: string[] }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { submission: { include: { report: true } }, photoJob: true },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status !== 'PAID') throw new BadRequestException('La orden no está pagada');

    const actions: string[] = [];

    // Análisis: re-encolar si no hay reporte entregado.
    const sub = order.submission;
    const analysisDone = sub?.status === 'DONE' && !!sub.report;
    if (sub && !analysisDone && (opts.force || RETRYABLE.includes(sub.status))) {
      await this.prisma.submission.update({
        where: { id: sub.id },
        data: { retryCount: 0, lastError: null },
      });
      await this.analysisPipeline.enqueue(orderId);
      actions.push('analysis');
    }

    // Fotos (solo tier premium): re-encolar si no están DONE.
    if (order.tier === 'AUDIT_PLUS_PHOTOS') {
      const pj = order.photoJob;
      const photosDone = pj?.status === 'DONE';
      if (!photosDone && (opts.force || !pj || RETRYABLE.includes(pj.status))) {
        if (pj) {
          await this.prisma.photoJob.update({
            where: { id: pj.id },
            data: { retryCount: 0, lastError: null },
          });
        }
        await this.photos.enqueue(orderId);
        actions.push('photos');
      }
    }

    await this.events.record('order.retry', { orderId, actions, admin: !!opts.admin });
    this.logger.log(
      `Retry orden ${orderId}: [${actions.join(', ') || 'nada pendiente'}]${opts.admin ? ' (admin)' : ''}`,
    );
    return { ok: true, actions };
  }
}
