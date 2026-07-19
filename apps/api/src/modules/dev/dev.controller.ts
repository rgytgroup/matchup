import { Controller, Get, Param, Post } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
  ) {}

  /** Dispara el pipeline de análisis para una orden (moderación → análisis → PDF → email). */
  @Post('process/:orderId')
  async process(@Param('orderId') orderId: string) {
    await this.pipeline.process(orderId);
    return { triggered: true, orderId };
  }

  /** Dispara el pipeline de fotos en segundo plano (entrenamiento + generación + QC). */
  @Post('photos/:orderId')
  startPhotos(@Param('orderId') orderId: string) {
    void this.photos.startJob(orderId).catch(() => undefined);
    return { triggered: true, orderId };
  }

  /** Estado del job de fotos, para monitorear el entrenamiento/generación. */
  @Get('photos/:orderId')
  async photosStatus(@Param('orderId') orderId: string) {
    return this.prisma.photoJob.findUnique({ where: { orderId } });
  }
}
