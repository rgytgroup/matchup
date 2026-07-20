import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersModule } from '../orders/orders.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { EXTRACTION_QUEUE } from '../../queue/queue.constants';
import { ExtractionPipelineService } from './extraction-pipeline.service';
import { ExtractionProcessor } from './extraction.processor';
import { ExtractionController } from './extraction.controller';

@Module({
  imports: [OrdersModule, AnalysisModule, BullModule.registerQueue({ name: EXTRACTION_QUEUE })],
  controllers: [ExtractionController],
  providers: [ExtractionPipelineService, ExtractionProcessor],
})
export class ExtractionModule {}
