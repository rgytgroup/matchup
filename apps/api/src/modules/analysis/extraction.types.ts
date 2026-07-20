import { z } from 'zod';

/** Perfil extraído de los screenshots por Gemini (SPEC §5.0). */
export const extractedProfileSchema = z.object({
  platform: z.enum(['tinder', 'hinge', 'bumble', 'other', 'unknown']),
  isOwnProfile: z.boolean(),
  bioText: z.string().default(''),
  prompts: z.array(z.object({ prompt: z.string(), answer: z.string() })).default([]),
  photoCrops: z
    .array(
      z.object({
        screenshotIndex: z.number().int().nonnegative(),
        // [x, y, w, h] como fracciones 0–1 del tamaño del screenshot.
        boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1),
});

export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;
