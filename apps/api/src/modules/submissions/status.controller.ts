import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { SubmissionsService } from './submissions.service';

/** Estado del procesamiento por polling (SPEC §4.5). */
@Controller('status')
export class StatusController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly reports: ReportsService,
  ) {}

  @Get(':orderId')
  async get(@Param('orderId') orderId: string) {
    const submission = await this.submissions.findByOrderId(orderId);
    if (!submission) throw new NotFoundException('Orden no encontrada');

    const report =
      submission.status === 'DONE' ? await this.reports.findBySubmissionId(submission.id) : null;
    return {
      status: submission.status,
      intakeMode: submission.intakeMode,
      platform: submission.platform,
      extractedProfile: submission.extractedProfile ?? null,
      reportSlug: report?.publicSlug ?? null,
    };
  }
}
