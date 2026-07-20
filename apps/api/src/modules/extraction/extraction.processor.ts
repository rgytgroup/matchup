import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EXTRACTION_QUEUE } from '../../queue/queue.constants';
import { ExtractionPipelineService } from './extraction-pipeline.service';

/** Worker que consume la cola de extracción (durable). */
@Processor(EXTRACTION_QUEUE, { concurrency: 3 })
export class ExtractionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(private readonly extraction: ExtractionPipelineService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    this.logger.log(`Extrayendo perfil de la orden ${job.data.orderId}`);
    await this.extraction.process(job.data.orderId);
  }
}
