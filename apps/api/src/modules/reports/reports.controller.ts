import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { ReportResult } from '@matchup/shared';
import { StorageService } from '../../storage/storage.service';
import { ReportsService } from './reports.service';

@Controller('report')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly storage: StorageService,
  ) {}

  /** Reporte público por slug, sin login (SPEC §4.4). Firma el PDF al vuelo. */
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const report = await this.reports.findBySlug(slug);
    if (!report) throw new NotFoundException('Reporte no encontrado');

    const pdfUrl = report.pdfUrl ? (await this.storage.signUrls([report.pdfUrl], 3600))[0] : null;
    return {
      slug: report.publicSlug,
      result: report.resultJson as unknown as ReportResult,
      pdfUrl,
      createdAt: report.createdAt,
    };
  }
}
