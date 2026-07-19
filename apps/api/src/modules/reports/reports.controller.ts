import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { ReportResult } from '@matchup/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ReportsService } from './reports.service';

@Controller('report')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /** Reporte público por slug, sin login (SPEC §4.4). Firma el PDF y las fotos al vuelo. */
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const report = await this.reports.findBySlug(slug);
    if (!report) throw new NotFoundException('Reporte no encontrado');

    const pdfUrl = report.pdfUrl ? (await this.storage.signUrls([report.pdfUrl], 3600))[0] : null;

    // Galería de fotos IA del tier premium (si existe y están listas).
    const submission = await this.prisma.submission.findUnique({
      where: { id: report.submissionId },
      include: { order: { include: { photoJob: true } } },
    });
    const photoPaths = submission?.order?.photoJob?.acceptedUrls ?? [];
    const photos = photoPaths.length > 0 ? await this.storage.signUrls(photoPaths, 3600) : [];

    return {
      slug: report.publicSlug,
      result: report.resultJson as unknown as ReportResult,
      pdfUrl,
      photos,
      createdAt: report.createdAt,
    };
  }
}
