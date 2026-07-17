import { Controller, Param, Post } from '@nestjs/common';
import { AnalysisPipelineService } from '../analysis/analysis-pipeline.service';

/**
 * Endpoints de desarrollo (NO se registran en producción; ver app.module.ts).
 * Sirven para probar el pipeline sin depender de un pago real de Stripe.
 */
@Controller('dev')
export class DevController {
  constructor(private readonly pipeline: AnalysisPipelineService) {}

  /** Dispara el pipeline de análisis para una orden ya existente (moderación → análisis → PDF → email). */
  @Post('process/:orderId')
  async process(@Param('orderId') orderId: string) {
    await this.pipeline.process(orderId);
    return { triggered: true, orderId };
  }
}
