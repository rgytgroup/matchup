import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../storage/storage.service';
import { EmailService } from '../../notifications/email.service';
import { OrdersService } from '../orders/orders.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { ReportsService } from '../reports/reports.service';
import { ReportPdfService } from '../reports/report-pdf.service';
import { AnalysisService } from './analysis.service';

/**
 * Orquesta el pipeline tras el pago (SPEC §5):
 * moderación → análisis (validar+reintento) → PDF → email, sin intervención manual.
 */
@Injectable()
export class AnalysisPipelineService {
  private readonly logger = new Logger(AnalysisPipelineService.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly submissions: SubmissionsService,
    private readonly analysis: AnalysisService,
    private readonly reports: ReportsService,
    private readonly pdf: ReportPdfService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly events: EventsService,
    private readonly config: ConfigService,
  ) {}

  /** Llamado desde el webhook. Dispara el procesamiento en segundo plano. */
  async enqueue(orderId: string): Promise<void> {
    await this.events.record('analysis.enqueued', { orderId });
    // Fire-and-forget: el webhook responde 200 sin esperar el análisis.
    // TODO(escala): reemplazar por una cola/worker real (BullMQ, etc.).
    void this.process(orderId).catch((err) =>
      this.logger.error(`process(${orderId}) lanzó: ${(err as Error).message}`),
    );
  }

  async process(orderId: string): Promise<void> {
    const order = await this.orders.findById(orderId);
    const submission = order?.submission;
    if (!order || !submission) {
      this.logger.warn(`process: sin submission para la orden ${orderId}`);
      return;
    }

    await this.submissions.setStatus(submission.id, 'ANALYZING');

    try {
      const signedUrls = await this.storage.signUrls(submission.photoUrls, 3600);

      const moderation = await this.analysis.moderate(signedUrls);
      if (!moderation.allowed) {
        await this.submissions.setStatus(submission.id, 'FAILED');
        await this.events.record('analysis.rejected', { orderId, reasons: moderation.reasons });
        return;
      }

      const result = await this.analysis.analyze({
        photoUrls: signedUrls,
        bioText: submission.bioText,
        questionnaire: submission.questionnaire,
      });

      const report = await this.reports.create(submission.id, result);

      const pdfBuffer = await this.pdf.render(result);
      const pdfPath = await this.storage.uploadPdf(`reports/${report.publicSlug}.pdf`, pdfBuffer);
      await this.reports.setPdfUrl(report.id, pdfPath);

      await this.submissions.setStatus(submission.id, 'DONE');

      const reportUrl = `${this.config.get<string>('APP_BASE_URL')}/report/${report.publicSlug}`;
      await this.email.sendReportReady(order.user.email, reportUrl);

      await this.events.record('analysis.done', { orderId, submissionId: submission.id });
    } catch (err) {
      await this.submissions.setStatus(submission.id, 'FAILED');
      await this.events.record('analysis.failed', { orderId, error: (err as Error).message });
      this.logger.error(`Análisis FAILED (orden ${orderId}): ${(err as Error).message}`);
      await this.email
        .alertAdmin(`MatchUp: análisis FAILED (${orderId})`, (err as Error).stack ?? String(err))
        .catch(() => undefined);
    }
  }
}
