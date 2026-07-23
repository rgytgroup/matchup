import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PLATFORM_LABELS, type ReportResult } from '@matchup/shared';

const INK = '#0f172a';
const MUTED = '#475569';
const LIGHT = '#64748b';
const MARGIN = 50;

/**
 * Genera el PDF del reporte server-side (SPEC §5.4), con estilo de marca cercano
 * al reporte web (header, colores, secciones). Nota: para un PDF pixel-idéntico al
 * HTML haría falta un navegador headless (puppeteer); esto es una versión fiel y ligera.
 */
@Injectable()
export class ReportPdfService {
  render(result: ReportResult): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header de marca.
      doc.rect(0, 0, doc.page.width, 92).fill(INK);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(26).text('Truly', MARGIN, 30);
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#cbd5e1')
        .text('Honest AI dating profile audit', MARGIN, 62);

      // Cuerpo.
      doc.fillColor(INK);
      doc.x = MARGIN;
      doc.y = 120;

      doc.font('Helvetica').fontSize(10).fillColor(LIGHT).text('OVERALL SCORE');
      const scoreLine =
        result.potentialScore != null
          ? `${result.overallScore} / 100   →   potential ${result.potentialScore}`
          : `${result.overallScore} / 100`;
      doc.font('Helvetica-Bold').fontSize(34).fillColor(INK).text(scoreLine);
      if (result.platform) {
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(MUTED)
          .text(`Optimized for ${PLATFORM_LABELS[result.platform]}`);
      }

      this.section(doc, 'Photo-by-photo');
      result.photos.forEach((p) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(INK)
          .text(`Photo ${p.index + 1} — ${p.score}/100`, { continued: true })
          .font('Helvetica')
          .fillColor(p.keep ? '#16a34a' : '#d97706')
          .text(p.keep ? '   ·  Keep' : '   ·  Consider dropping');
        if (p.issues.length) {
          doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`Issues: ${p.issues.join('; ')}`);
        }
        if (p.strengths.length) {
          doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`Strengths: ${p.strengths.join('; ')}`);
        }
        if (p.recommendation) {
          doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text(`→ ${p.recommendation}`);
        }
        doc.moveDown(0.4);
      });

      if (result.missingArchetypes.length) {
        this.section(doc, 'Missing photo types');
        doc.font('Helvetica').fontSize(11).fillColor('#334155').list(result.missingArchetypes);
      }

      this.section(doc, 'Bio diagnosis');
      doc.font('Helvetica').fontSize(11).fillColor('#334155').text(result.bioDiagnosis);

      this.section(doc, 'Rewritten bios');
      result.rewrittenBios.forEach((b) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(INK)
          .text(`${b.style}${b.best ? '  (best)' : ''}`);
        doc.font('Helvetica').fontSize(11).fillColor('#334155').text(b.text).moveDown(0.3);
      });

      if (result.suggestedPrompts.length) {
        this.section(doc, 'Suggested prompts');
        result.suggestedPrompts.forEach((p) => {
          doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(p.prompt);
          doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(p.answer);
          if (p.why) doc.font('Helvetica-Oblique').fontSize(9).fillColor(LIGHT).text(`Why it works: ${p.why}`);
          doc.moveDown(0.2);
        });
      }

      this.section(doc, 'Your action plan');
      result.actionPlan.forEach((task, i) => {
        const meta = [task.minutes != null ? `${task.minutes} min` : null, task.impact ? `${task.impact} impact` : null]
          .filter(Boolean)
          .join(' · ');
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#334155')
          .text(`${i + 1}. ${task.task}${meta ? `  (${meta})` : ''}`)
          .moveDown(0.15);
      });

      doc.end();
    });
  }

  private section(doc: PDFKit.PDFDocument, title: string): void {
    doc.moveDown(0.9);
    const y = doc.y;
    doc.rect(MARGIN, y + 2, 4, 14).fill(INK); // barra de acento
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(title, MARGIN + 12, y);
    doc.moveDown(0.4);
    doc.x = MARGIN;
  }
}
