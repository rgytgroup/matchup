import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** Envío de emails transaccionales con Resend (SPEC §5.4). */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: Resend | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Resend {
    if (this.client) return this.client;
    const key = this.config.get<string>('RESEND_API_KEY');
    if (!key) throw new Error('RESEND_API_KEY no configurada');
    this.client = new Resend(key);
    return this.client;
  }

  private get from(): string {
    return this.config.get<string>('EMAIL_FROM') ?? 'Truly <onboarding@resend.dev>';
  }

  async sendReportReady(to: string, reportUrl: string): Promise<void> {
    await this.getClient().emails.send({
      from: this.from,
      to,
      subject: 'Your Truly report is ready',
      html: `
        <p>Your dating profile audit is ready.</p>
        <p><a href="${reportUrl}">View your report</a></p>
        <p>This link is private — don't share it if you don't want others to see your report.</p>
      `,
    });
  }

  async sendPhotosReady(to: string, reportUrl: string): Promise<void> {
    await this.getClient().emails.send({
      from: this.from,
      to,
      subject: 'Your Truly AI photos are ready',
      html: `
        <p>Your AI-generated photos are ready!</p>
        <p><a href="${reportUrl}">View your photos</a></p>
      `,
    });
  }

  async sendRefund(to: string): Promise<void> {
    await this.getClient().emails.send({
      from: this.from,
      to,
      subject: 'Your Truly refund has been processed',
      html: `
        <p>Your refund has been processed and should appear on your statement within a few business days.</p>
        <p>If you have any questions, email us at <a href="mailto:support@truly.dating">support@truly.dating</a>.</p>
      `,
    });
  }

  /** Alerta al admin ante fallos que requieren revisión manual (SPEC §5.3, §6.4). */
  async alertAdmin(subject: string, text: string): Promise<void> {
    const to = this.config.get<string>('ADMIN_ALERT_EMAIL');
    if (!to) {
      this.logger.warn(`ADMIN_ALERT_EMAIL no configurada; no se envió alerta: ${subject}`);
      return;
    }
    await this.getClient().emails.send({ from: this.from, to, subject, text });
  }
}
