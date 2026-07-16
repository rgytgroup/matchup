import { Module } from '@nestjs/common';
import { SubmissionsModule } from '../submissions/submissions.module';
import { ReportsModule } from '../reports/reports.module';
import { ANALYSIS_PROVIDER } from './analysis-provider.interface';
import { GeminiAnalysisProvider } from './providers/gemini.provider';
import { AnalysisService } from './analysis.service';
import { AnalysisPipelineService } from './analysis-pipeline.service';

@Module({
  imports: [SubmissionsModule, ReportsModule],
  providers: [
    AnalysisService,
    AnalysisPipelineService,
    { provide: ANALYSIS_PROVIDER, useClass: GeminiAnalysisProvider },
  ],
  exports: [AnalysisService, AnalysisPipelineService],
})
export class AnalysisModule {}
