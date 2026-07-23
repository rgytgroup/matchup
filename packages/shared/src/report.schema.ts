import { z } from 'zod';
import { PLATFORMS } from './platforms';

/**
 * Schema del resultado de análisis (SPEC §5).
 * Esta es la ÚNICA fuente de verdad del contrato del reporte:
 * el backend valida la salida de Gemini contra esto (1 reintento si falla,
 * luego FAILED) y el frontend renderiza el reporte a partir del mismo tipo.
 */

const score = z.number().min(0).max(100);

export const photoAnalysisSchema = z.object({
  index: z.number().int().nonnegative(),
  score,
  keep: z.boolean(),
  issues: z.array(z.string()),
  strengths: z.array(z.string()),
});

export const suggestedPromptSchema = z.object({
  prompt: z.string().min(1),
  answer: z.string().min(1),
});

/** Subscore por categoría (SPEC §5.1.2c): la IA devuelve score Y conteo de sugerencias. */
export const categoryScoreSchema = z.object({
  score,
  suggestions: z.number().int().min(0),
});

export const categoryScoresSchema = z.object({
  photos: categoryScoreSchema,
  bio: categoryScoreSchema,
  prompts: categoryScoreSchema,
});

export const reportResultSchema = z.object({
  // Plataforma para la que está optimizado el reporte (SPEC §5.1). Opcional para
  // tolerar reportes antiguos; el prompt pide incluirla.
  platform: z.enum(PLATFORMS).optional(),
  overallScore: score,
  // Score alcanzable con el actionPlan aplicado (SPEC §5.1.2c). Opcional para
  // tolerar reportes antiguos; el prompt lo pide siempre para reportes nuevos.
  potentialScore: score.optional(),
  categoryScores: categoryScoresSchema.optional(),
  photos: z.array(photoAnalysisSchema).min(1),
  missingArchetypes: z.array(z.string()),
  bioDiagnosis: z.string().min(1),
  // Producto apunta a 3 bios y plan de 5 pasos; se piden mín. para tolerar
  // variación del modelo sin disparar FAILED innecesariamente (SPEC §9: ≥95% válidos).
  rewrittenBios: z.array(z.string().min(1)).min(1),
  suggestedPrompts: z.array(suggestedPromptSchema),
  actionPlan: z.array(z.string().min(1)).min(1),
});

export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;
export type SuggestedPrompt = z.infer<typeof suggestedPromptSchema>;
export type CategoryScores = z.infer<typeof categoryScoresSchema>;
export type ReportResult = z.infer<typeof reportResultSchema>;

/** Objetivos de producto (para prompts / UI), no restricciones duras del schema. */
export const REPORT_TARGETS = {
  rewrittenBios: 3,
  actionPlanSteps: 5,
} as const;
