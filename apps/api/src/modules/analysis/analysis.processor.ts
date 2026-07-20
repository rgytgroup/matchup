import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ANALYSIS_QUEUE } from '../../queue/queue.constants';
import { AnalysisPipelineService } from './analysis-pipeline.service';

/** Worker que consume la cola de análisis (durable, sobrevive reinicios). */
@Processor(ANALYSIS_QUEUE, { concurrency: 3 })
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(private readonly pipeline: AnalysisPipelineService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    this.logger.log(`Procesando análisis de la orden ${job.data.orderId}`);
    await this.pipeline.process(job.data.orderId);
  }
}
