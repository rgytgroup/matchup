import { Injectable, Logger } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { ReportsService } from '../reports/reports.service';
import { AnalysisService } from './analysis.service';

/**
 * Orquesta el pipeline de análisis tras el pago (SPEC §5).
 * `enqueue` marca la submission y registra la intención; un worker (futuro)
 * invoca `process`, que ejecuta moderación → análisis (validar+reintento) → reporte.
 */
@Injectable()
export class AnalysisPipelineService {
  private readonly logger = new Logger(AnalysisPipelineService.name);

  constructor(
    private readonly submissions: SubmissionsService,
    private readonly analysis: AnalysisService,
    private readonly reports: ReportsService,
    private readonly events: EventsService,
  ) {}

  async enqueue(orderId: string): Promise<void> {
    const submission = await this.submissions.findByOrderId(orderId);
    if (!submission) {
      this.logger.warn(`enqueue: no hay submission para la orden ${orderId}`);
      return;
    }
    await this.submissions.setStatus(submission.id, 'ANALYZING');
    await this.events.record('analysis.enqueued', { orderId, submissionId: submission.id });
    // TODO(pipeline): disparar process() vía cola/worker en vez de dejarlo pendiente.
  }

  async process(orderId: string): Promise<void> {
    const submission = await this.submissions.findByOrderId(orderId);
    if (!submission) throw new Error(`process: submission inexistente para orden ${orderId}`);

    try {
      const moderation = await this.analysis.moderate(submission.photoUrls);
      if (!moderation.allowed) {
        await this.submissions.setStatus(submission.id, 'FAILED');
        await this.events.record('analysis.rejected', { orderId, reasons: moderation.reasons });
        return;
      }

      const result = await this.analysis.analyze({
        photoUrls: submission.photoUrls,
        bioText: submission.bioText,
        questionnaire: submission.questionnaire,
      });

      await this.reports.create(submission.id, result);
      await this.submissions.setStatus(submission.id, 'DONE');
      await this.events.record('analysis.done', { orderId, submissionId: submission.id });
      // TODO(pipeline): generar PDF (SPEC §5.4) y enviar email con el link (Resend).
    } catch (err) {
      await this.submissions.setStatus(submission.id, 'FAILED');
      await this.events.record('analysis.failed', { orderId, error: (err as Error).message });
      this.logger.error(`Análisis FAILED (orden ${orderId}): ${(err as Error).message}`);
      // TODO(alertas): alertar al admin ante FAILED (SPEC §5.3).
    }
  }
}
