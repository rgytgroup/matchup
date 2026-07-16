import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportPdfService } from './report-pdf.service';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService],
  exports: [ReportsService, ReportPdfService],
})
export class ReportsModule {}
