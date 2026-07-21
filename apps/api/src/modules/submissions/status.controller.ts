import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { SubmissionsService } from './submissions.service';

/** Estado del procesamiento por polling (SPEC §4.5). */
@Controller('status')
export class StatusController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':orderId')
  async get(@Param('orderId') orderId: string) {
    const submission = await this.submissions.findByOrderId(orderId);
    if (!submission) throw new NotFoundException('Orden no encontrada');

    const report =
      submission.status === 'DONE' ? await this.reports.findBySubmissionId(submission.id) : null;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { photoJob: true },
    });

    return {
      status: submission.status,
      intakeMode: submission.intakeMode,
      platform: submission.platform,
      extractedProfile: submission.extractedProfile ?? null,
      reportSlug: report?.publicSlug ?? null,
      tier: order?.tier ?? null,
      // Estado del job de fotos (solo aplica al tier premium); null si no existe aún.
      photosJobStatus: order?.photoJob?.status ?? null,
    };
  }
}
