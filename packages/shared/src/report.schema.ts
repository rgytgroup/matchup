import { z } from 'zod';
import { PLATFORMS } from './platforms';

/**
 * Schema del resultado de análisis (SPEC §5, §14). ÚNICA fuente de verdad del
 * contrato del reporte: el backend valida la salida de Gemini contra esto y el
 * frontend (Reporte v2) lo renderiza. Campos v2 opcionales toleran reportes viejos.
 */

const score = z.number().min(0).max(100);

export const photoAnalysisSchema = z.object({
  index: z.number().int().nonnegative(),
  score,
  keep: z.boolean(),
  issues: z.array(z.string()),
  strengths: z.array(z.string()),
  // Recomendación corta accionable por foto (SPEC §14.5).
  recommendation: z.string().optional(),
});

export const suggestedPromptSchema = z.object({
  prompt: z.string().min(1),
  answer: z.string().min(1),
  // Por qué funciona — hace visible el razonamiento de la IA (SPEC §14.8).
  why: z.string().optional(),
});

/** Bio reescrita como tarjeta con estilo (SPEC §14.7). */
export const rewrittenBioSchema = z.object({
  style: z.string().min(1), // Conversation Starter | Funny | Adventure | Confident…
  text: z.string().min(1),
  best: z.boolean().optional(),
});

/** Tarea del plan de acción (SPEC §14.9): prioridad/tiempo/impacto. */
export const actionTaskSchema = z.object({
  task: z.string().min(1),
  minutes: z.number().int().positive().optional(),
  impact: z.enum(['High', 'Medium', 'Low']).optional(),
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

/** Diagnóstico de bio escaneable (SPEC §14.6): marcas + porqué/impacto/dirección. */
export const bioAnalysisSchema = z.object({
  marks: z.array(z.string()).default([]), // "Reads generic", "Lists traits"…
  why: z.string().optional(),
  impact: z.string().optional(),
  direction: z.string().optional(),
});

export const reportResultSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  overallScore: score,
  // Score alcanzable con el actionPlan (SPEC §5.1.2c).
  potentialScore: score.optional(),
  categoryScores: categoryScoresSchema.optional(),
  photos: z.array(photoAnalysisSchema).min(1),
  missingArchetypes: z.array(z.string()),
  bioDiagnosis: z.string().min(1),
  bioAnalysis: bioAnalysisSchema.optional(),
  // v2: bios como tarjetas con estilo (SPEC §14.7).
  rewrittenBios: z.array(rewrittenBioSchema).min(1),
  suggestedPrompts: z.array(suggestedPromptSchema),
  // v2: plan como tareas con prioridad/tiempo/impacto (SPEC §14.9).
  actionPlan: z.array(actionTaskSchema).min(1),
});

export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;
export type SuggestedPrompt = z.infer<typeof suggestedPromptSchema>;
export type RewrittenBio = z.infer<typeof rewrittenBioSchema>;
export type ActionTask = z.infer<typeof actionTaskSchema>;
export type CategoryScores = z.infer<typeof categoryScoresSchema>;
export type BioAnalysis = z.infer<typeof bioAnalysisSchema>;
export type ReportResult = z.infer<typeof reportResultSchema>;

/** Objetivos de producto (para prompts / UI), no restricciones duras del schema. */
export const REPORT_TARGETS = {
  rewrittenBios: 3,
  actionPlanSteps: 5,
} as const;
