import { Inject, Injectable, Logger } from '@nestjs/common';
import { REPORT_TARGETS, reportResultSchema, type ReportResult } from '@matchup/shared';
import { PromptLoaderService } from '../../prompts/prompt-loader.service';
import { ANALYSIS_PROVIDER, type AnalysisProvider } from './analysis-provider.interface';
import { moderationResultSchema, type ModerationResult } from './analysis.types';

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
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @Inject(ANALYSIS_PROVIDER) private readonly provider: AnalysisProvider,
    private readonly prompts: PromptLoaderService,
  ) {}

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
      if (parsed.success) return parsed.data;

      lastError = JSON.stringify(parsed.error.flatten());
      prompt = this.withFeedback(basePrompt, lastError);
      this.logger.warn(`Intento ${attempt}: validación falló: ${lastError}`);
    }

    throw new AnalysisValidationError(lastError);
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
