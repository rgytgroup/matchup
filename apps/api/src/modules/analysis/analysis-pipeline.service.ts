import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ANALYSIS_QUEUE } from '../../queue/queue.constants';
import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../storage/storage.service';
import { EmailService } from '../../notifications/email.service';
import { isTransientError, MAX_PIPELINE_ATTEMPTS, RETRY_BACKOFF_MS } from '../../common/retry.util';
import { OrdersService } from '../orders/orders.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { ReportsService } from '../reports/reports.service';
import { ReportPdfService } from '../reports/report-pdf.service';
import { AnalysisService } from './analysis.service';

/**
 * Orquesta el pipeline tras el pago (SPEC §5):
 * moderación → análisis (validar+reintento) → PDF → email, sin intervención manual.
 * Recuperación de fallos (SPEC §11): idempotente/reanudable, reintentos con tope,
 * y NEEDS_ATTENTION cuando se agotan (nunca deja un Order PAID sin entrega).
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
    @InjectQueue(ANALYSIS_QUEUE) private readonly queue: Queue,
  ) {}

  /** Encola el análisis en la cola durable (BullMQ) con reintentos + backoff (SPEC §11.3). */
  async enqueue(orderId: string): Promise<void> {
    await this.events.record('analysis.enqueued', { orderId });
    const jobId = `analysis-${orderId}`;
    // Quita cualquier job previo con este id (permite re-encolar tras un fallo).
    await this.queue.remove(jobId).catch(() => undefined);
    await this.queue.add(
      'process',
      { orderId },
      {
        jobId,
        attempts: MAX_PIPELINE_ATTEMPTS,
        backoff: { type: 'exponential', delay: RETRY_BACKOFF_MS },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  /**
   * @param isLastAttempt si BullMQ ya no reintentará tras este fallo (para decidir
   * entre relanzar el error —reintento— o marcar NEEDS_ATTENTION).
   */
  async process(orderId: string, isLastAttempt = true): Promise<void> {
    const order = await this.orders.findById(orderId);
    const submission = order?.submission;
    if (!order || !submission) {
      this.logger.warn(`process: sin submission para la orden ${orderId}`);
      return;
    }

    // Idempotencia (SPEC §11.2): si el reporte ya existe, no re-analizar;
    // solo reanudar la cola de PDF/email/estado si algo quedó a medias.
    const existing = await this.reports.findBySubmissionId(submission.id);
    if (existing) {
      await this.finishReport(orderId, submission.id, order.user.email, existing);
      return;
    }

    await this.submissions.setStatus(submission.id, 'ANALYZING');

    try {
      const signedUrls = await this.storage.signUrls(submission.photoUrls, 3600);

      const moderation = await this.analysis.moderate(signedUrls);
      if (!moderation.allowed) {
        // Rechazo de contenido: terminal, NO se reintenta (SPEC §8).
        await this.submissions.setStatus(submission.id, 'FAILED');
        await this.events.record('analysis.rejected', { orderId, reasons: moderation.reasons });
        return;
      }

      const result = await this.analysis.analyze({
        photoUrls: signedUrls,
        bioText: submission.bioText,
        questionnaire: submission.questionnaire,
        platform: submission.platform ?? undefined,
      });

      const report = await this.reports.create(submission.id, result);
      await this.finishReport(orderId, submission.id, order.user.email, report);
    } catch (err) {
      await this.handleFailure(orderId, submission.id, err, isLastAttempt);
    }
  }

  /** Reanuda la cola tras tener el Report: PDF (si falta) → estado DONE → email best-effort. */
  private async finishReport(
    orderId: string,
    submissionId: string,
    email: string,
    report: { id: string; publicSlug: string; pdfUrl: string | null; resultJson: unknown },
  ): Promise<void> {
    if (!report.pdfUrl) {
      const pdfBuffer = await this.pdf.render(report.resultJson as Parameters<ReportPdfService['render']>[0]);
      const pdfPath = await this.storage.uploadPdf(`reports/${report.publicSlug}.pdf`, pdfBuffer);
      await this.reports.setPdfUrl(report.id, pdfPath);
    }

    await this.submissions.setStatus(submissionId, 'DONE');
    await this.events.record('analysis.done', { orderId, submissionId });

    // Email best-effort: el reporte ya es accesible por slug aunque el email falle.
    try {
      const reportUrl = `${this.config.get<string>('APP_BASE_URL')}/report/${report.publicSlug}`;
      await this.email.sendReportReady(email, reportUrl);
    } catch (mailErr) {
      this.logger.warn(`No se pudo enviar el email (¿RESEND_API_KEY?): ${(mailErr as Error).message}`);
    }
  }

  /** Reintento (transitorio + quedan intentos) o NEEDS_ATTENTION (agotado/estructural). SPEC §11.3. */
  private async handleFailure(
    orderId: string,
    submissionId: string,
    err: unknown,
    isLastAttempt: boolean,
  ): Promise<void> {
    const message = (err as Error).message ?? String(err);
    await this.submissions.recordError(submissionId, message);
    Sentry.captureException(err, { extra: { orderId, phase: 'analysis' } });

    if (isTransientError(err) && !isLastAttempt) {
      this.logger.warn(`Análisis transitorio (orden ${orderId}), reintentará: ${message}`);
      throw err; // BullMQ reintenta con backoff.
    }

    await this.submissions.setStatus(submissionId, 'NEEDS_ATTENTION');
    await this.events.record('analysis.needs_attention', { orderId, error: message });
    this.logger.error(`Análisis NEEDS_ATTENTION (orden ${orderId}): ${message}`);
    await this.email
      .alertAdmin(
        `Truly: análisis requiere atención (${orderId})`,
        `Tras ${MAX_PIPELINE_ATTEMPTS} intentos.\n${(err as Error).stack ?? message}`,
      )
      .catch(() => undefined);
  }
}
