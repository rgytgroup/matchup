import { z } from 'zod';

/** Resultado del pase de moderación con visión (SPEC §8). */
export const moderationResultSchema = z.object({
  allowed: z.boolean(),
  reasons: z.array(z.string()).default([]),
  flaggedIndexes: z.array(z.number().int()).default([]),
});

export type ModerationResult = z.infer<typeof moderationResultSchema>;
