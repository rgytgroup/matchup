import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { ReportResult } from '@matchup/shared';

/**
 * Genera el PDF del reporte server-side (SPEC §5.4).
 * Renderiza el mismo contenido que el reporte web a partir del resultado validado.
 */
@Injectable()
export class ReportPdfService {
  render(result: ReportResult): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(22).text('MatchUp — Profile Audit', { align: 'left' });
      doc.moveDown(0.5);
      doc.fontSize(16).text(`Overall score: ${result.overallScore}/100`);
      doc.moveDown();

      this.section(doc, 'Photo-by-photo');
      result.photos.forEach((p) => {
        doc
          .fontSize(12)
          .text(`Photo ${p.index + 1}: ${p.score}/100 — ${p.keep ? 'Keep' : 'Consider dropping'}`);
        if (p.issues.length) doc.fontSize(10).text(`Issues: ${p.issues.join('; ')}`);
        if (p.strengths.length) doc.fontSize(10).text(`Strengths: ${p.strengths.join('; ')}`);
        doc.moveDown(0.3);
      });

      if (result.missingArchetypes.length) {
        this.section(doc, 'Missing photo types');
        doc.fontSize(11).list(result.missingArchetypes);
      }

      this.section(doc, 'Bio diagnosis');
      doc.fontSize(11).text(result.bioDiagnosis);

      this.section(doc, 'Rewritten bios');
      result.rewrittenBios.forEach((b, i) => doc.fontSize(11).text(`${i + 1}. ${b}`).moveDown(0.2));

      if (result.suggestedPrompts.length) {
        this.section(doc, 'Suggested prompts');
        result.suggestedPrompts.forEach((p) =>
          doc.fontSize(11).text(`${p.prompt}`).fontSize(10).text(p.answer).moveDown(0.2),
        );
      }

      this.section(doc, 'Action plan');
      doc.fontSize(11).list(result.actionPlan);

      doc.end();
    });
  }

  private section(doc: PDFKit.PDFDocument, title: string): void {
    doc.moveDown().fontSize(14).fillColor('#111').text(title).moveDown(0.3).fillColor('#333');
  }
}
