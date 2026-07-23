import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PLATFORM_LABELS, type ReportResult } from '@matchup/shared';

// PDF en versión CLARA (SPEC §13.5): fondo blanco, texto negro, acentos cobre,
// KEEP verde, DROP ámbar. Imprime mejor y se lee/comparte mejor que el tema oscuro.
const INK = '#1E1912';
const MUTED = '#5A5248';
const LIGHT = '#8A8278';
const ACCENT = '#C9741F';
const GREEN = '#2E9E5F';
const AMBER = '#B77B12';
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

      // Header de marca (claro): logo cobre + regla cobre.
      doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(26).text('Truly', MARGIN, 34);
      doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('Honest AI dating profile audit', MARGIN, 66);
      doc.rect(MARGIN, 88, doc.page.width - MARGIN * 2, 2).fill(ACCENT);

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
          .fillColor(p.keep ? GREEN : AMBER)
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
    doc.rect(MARGIN, y + 2, 4, 14).fill(ACCENT); // barra de acento cobre
    doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(title, MARGIN + 12, y);
    doc.moveDown(0.4);
    doc.x = MARGIN;
  }
}
