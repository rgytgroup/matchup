import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CleanupService } from '../../cleanup/cleanup.service';
import { AnalysisPipelineService } from '../analysis/analysis-pipeline.service';
import { PhotosService } from '../photos/photos.service';

/**
 * Endpoints de desarrollo (NO se registran en producción; ver app.module.ts).
 * Sirven para probar los pipelines sin depender de un pago real de Stripe.
 */
@Controller('dev')
export class DevController {
  constructor(
    private readonly pipeline: AnalysisPipelineService,
    private readonly photos: PhotosService,
    private readonly prisma: PrismaService,
    private readonly cleanup: CleanupService,
  ) {}

  /** Dispara el pipeline de análisis para una orden (moderación → análisis → PDF → email). */
  @Post('process/:orderId')
  async process(@Param('orderId') orderId: string) {
    await this.pipeline.process(orderId);
    return { triggered: true, orderId };
  }

  /** Encola el análisis (prueba el circuito cola durable → worker). */
  @Post('enqueue/:orderId')
  async enqueue(@Param('orderId') orderId: string) {
    await this.pipeline.enqueue(orderId);
    return { enqueued: true, orderId };
  }

  /** Lanza un error a propósito para verificar que Sentry lo captura. */
  @Get('sentry-test')
  sentryTest(): never {
    throw new Error('MatchUp Sentry test error (dev endpoint)');
  }

  /** Dispara el pipeline de fotos en segundo plano (entrenamiento + generación + QC). */
  @Post('photos/:orderId')
  startPhotos(@Param('orderId') orderId: string) {
    void this.photos.startJob(orderId).catch(() => undefined);
    return { triggered: true, orderId };
  }

  /** Reanuda solo la generación + QC con un modelo ya entrenado (sin re-entrenar). */
  @Post('generate/:orderId')
  startGeneration(@Param('orderId') orderId: string, @Query('version') version?: string) {
    if (!version) throw new BadRequestException('falta ?version=owner/name:hash del modelo entrenado');
    void this.photos.resumeGeneration(orderId, version).catch(() => undefined);
    return { triggered: true, orderId, version };
  }

  /** Estado del job de fotos, para monitorear el entrenamiento/generación. */
  @Get('photos/:orderId')
  async photosStatus(@Param('orderId') orderId: string) {
    return this.prisma.photoJob.findUnique({ where: { orderId } });
  }

  /** Borra las fotos de una orden (prueba manual del cron de retención a 30 días). */
  @Post('cleanup/:orderId')
  async cleanupOrder(@Param('orderId') orderId: string) {
    await this.cleanup.cleanOrder(orderId);
    return { cleaned: true, orderId };
  }
}
