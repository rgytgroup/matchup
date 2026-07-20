import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import type { ReportResult } from '@matchup/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ReportsService } from './reports.service';

type PhotosStatus = 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';

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

    // Estado de la galería de fotos IA del tier premium (SPEC §4.4).
    const submission = await this.prisma.submission.findUnique({
      where: { id: report.submissionId },
      include: { order: { include: { photoJob: true } } },
    });
    const order = submission?.order;
    const job = order?.photoJob;

    let photosStatus: PhotosStatus = 'NONE';
    let photos: string[] = [];
    if (order?.tier === 'AUDIT_PLUS_PHOTOS') {
      if (job?.status === 'DONE') {
        photosStatus = 'READY';
        photos = await this.storage.signUrls(job.acceptedUrls, 3600);
      } else if (job?.status === 'FAILED') {
        photosStatus = 'FAILED';
      } else {
        photosStatus = 'PROCESSING'; // QUEUED / TRAINING / GENERATING / QC (o aún sin job)
      }
    }

    return {
      slug: report.publicSlug,
      result: report.resultJson as unknown as ReportResult,
      pdfUrl,
      photos,
      photosStatus,
      createdAt: report.createdAt,
    };
  }
}
