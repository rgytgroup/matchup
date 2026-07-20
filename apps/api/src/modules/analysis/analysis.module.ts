import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersModule } from '../orders/orders.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { ReportsModule } from '../reports/reports.module';
import { ANALYSIS_QUEUE } from '../../queue/queue.constants';
import { ANALYSIS_PROVIDER } from './analysis-provider.interface';
import { GeminiAnalysisProvider } from './providers/gemini.provider';
import { AnalysisService } from './analysis.service';
import { AnalysisPipelineService } from './analysis-pipeline.service';
import { AnalysisProcessor } from './analysis.processor';

@Module({
  imports: [
    OrdersModule,
    SubmissionsModule,
    ReportsModule,
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }),
  ],
  providers: [
    AnalysisService,
    AnalysisPipelineService,
    AnalysisProcessor,
    { provide: ANALYSIS_PROVIDER, useClass: GeminiAnalysisProvider },
  ],
  exports: [AnalysisService, AnalysisPipelineService],
})
export class AnalysisModule {}
