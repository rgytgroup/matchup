import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { REPORT_TARGETS, reportResultSchema, type ReportResult } from '@matchup/shared';
import { PromptLoaderService } from '../../prompts/prompt-loader.service';
import { ANALYSIS_PROVIDER, type AnalysisProvider } from './analysis-provider.interface';
import { moderationResultSchema, type ModerationResult } from './analysis.types';
import { extractedProfileSchema, type ExtractedProfile } from './extraction.types';

/** Se lanza cuando la salida de IA no pasa la validación tras el reintento (SPEC §5.3). */
export class AnalysisValidationError extends Error {
  constructor(public readonly details: string) {
    super('La salida de análisis no pasó la validación de schema tras el reintento');
    this.name = 'AnalysisValidationError';
  }
}

export interface AnalyzeInput {
  photoUrls: string[];
  bioText: string;
  questionnaire: unknown;
  platform?: string;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @Inject(ANALYSIS_PROVIDER) private readonly provider: AnalysisProvider,
    private readonly prompts: PromptLoaderService,
  ) {}

  /** Extrae el perfil desde screenshots (SPEC §5.0); 1 reintento si el JSON no valida. */
  async extractFromScreenshots(screenshotUrls: string[]): Promise<ExtractedProfile> {
    const prompt = this.prompts.load('extraction');
    let lastError = 'desconocido';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const raw = await this.provider.generateReportJson(prompt, screenshotUrls);
      try {
        const parsed = extractedProfileSchema.safeParse(this.parseJson(raw));
        if (parsed.success) return parsed.data;
        lastError = JSON.stringify(parsed.error.flatten());
      } catch (e) {
        lastError = `JSON inválido: ${(e as Error).message}`;
      }
      this.logger.warn(`Extracción intento ${attempt}: ${lastError}`);
    }
    throw new Error(`La extracción no pasó la validación: ${lastError}`);
  }

  /**
   * Teaser ligero de la puerta falsa (SPEC §12.1.1): UNA sola llamada sobre los
   * screenshots → score + una fortaleza específica + conteo REAL de problemas.
   */
  async teaser(screenshotUrls: string[]): Promise<{
    score: number;
    potentialScore: number;
    strength: string;
    problemCount: number;
    photoCount: number;
    categoryScores: {
      photos: { score: number; suggestions: number };
      bio: { score: number; suggestions: number };
      prompts: { score: number; suggestions: number };
    };
  }> {
    const prompt = this.prompts.load('teaser');
    const cat = z.object({
      score: z.number().int().min(0).max(100),
      suggestions: z.number().int().min(0).max(20),
    });
    const schema = z.object({
      score: z.number().int().min(0).max(100),
      potentialScore: z.number().int().min(0).max(100),
      strength: z.string().min(1),
      categoryScores: z.object({ photos: cat, bio: cat, prompts: cat }),
      photoCount: z.number().int().min(0).max(20).default(0),
    });
    let lastError = 'desconocido';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const raw = await this.provider.generateReportJson(prompt, screenshotUrls);
      const parsed = schema.safeParse(this.parseJson(raw));
      if (parsed.success) {
        const d = parsed.data;
        // Total de problemas = suma de suggestions (única fuente de verdad, SPEC §5.1.2c).
        const problemCount =
          d.categoryScores.photos.suggestions +
          d.categoryScores.bio.suggestions +
          d.categoryScores.prompts.suggestions;
        // Garantiza potentialScore > score y ≤ 95 (regla de honestidad).
        const potentialScore = Math.min(95, Math.max(d.potentialScore, d.score + 1));
        return { ...d, potentialScore, problemCount };
      }
      lastError = JSON.stringify(parsed.error.flatten());
      this.logger.warn(`Teaser intento ${attempt}: ${lastError}`);
    }
    throw new Error(`El teaser no pasó la validación: ${lastError}`);
  }

  async moderate(photoUrls: string[]): Promise<ModerationResult> {
    const prompt = this.prompts.load('moderation');
    const raw = await this.provider.moderate(prompt, photoUrls);
    return moderationResultSchema.parse(this.parseJson(raw));
  }

  /**
   * Genera el reporte y lo valida contra el schema del contrato (@matchup/shared).
   * Si la validación falla, reintenta UNA vez pasando el error como feedback (SPEC §5.3).
   */
  async analyze(input: AnalyzeInput): Promise<ReportResult> {
    const basePrompt = this.prompts.render('analysis-system', {
      platform: input.platform ?? 'unknown',
      questionnaire: JSON.stringify(input.questionnaire),
      bioText: input.bioText,
      photoCount: input.photoUrls.length,
      rewrittenBios: REPORT_TARGETS.rewrittenBios,
      actionPlanSteps: REPORT_TARGETS.actionPlanSteps,
    });

    let prompt = basePrompt;
    let lastError = 'desconocido';

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const raw = await this.provider.generateReportJson(prompt, input.photoUrls);

      let candidate: unknown;
      try {
        candidate = this.parseJson(raw);
      } catch (err) {
        lastError = `JSON no parseable: ${(err as Error).message}`;
        prompt = this.withFeedback(basePrompt, lastError);
        this.logger.warn(`Intento ${attempt}: ${lastError}`);
        continue;
      }

      const parsed = reportResultSchema.safeParse(candidate);
      if (parsed.success) {
        const r = parsed.data;
        // Garantiza potentialScore > overallScore y ≤ 95 (SPEC §5.1.2c).
        if (r.potentialScore != null) {
          r.potentialScore = Math.min(95, Math.max(r.potentialScore, r.overallScore + 1));
        }
        return r;
      }

      lastError = JSON.stringify(parsed.error.flatten());
      prompt = this.withFeedback(basePrompt, lastError);
      this.logger.warn(`Intento ${attempt}: validación falló: ${lastError}`);
    }

    throw new AnalysisValidationError(lastError);
  }

  /** QC de parecido facial (SPEC §6.3): 0-100 de qué tan parecida es la candidata a la referencia. */
  async scoreSimilarity(referenceUrl: string, candidateUrl: string): Promise<number> {
    const prompt = this.prompts.load('photo-qc');
    const raw = await this.provider.generateReportJson(prompt, [referenceUrl, candidateUrl]);
    try {
      const parsed = z
        .object({ similarity: z.number().min(0).max(100) })
        .safeParse(this.parseJson(raw));
      return parsed.success ? parsed.data.similarity : 0;
    } catch {
      return 0;
    }
  }

  private withFeedback(basePrompt: string, error: string): string {
    return `${basePrompt}\n\n## Errores de validación del intento anterior — corrígelos y devuelve SOLO JSON válido:\n${error}`;
  }

  private parseJson(raw: string): unknown {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  }
}
