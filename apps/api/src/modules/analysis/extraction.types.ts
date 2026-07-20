import { z } from 'zod';

/** Perfil extraído de los screenshots por Gemini (SPEC §5.0). */
export const extractedProfileSchema = z.object({
  platform: z.enum(['tinder', 'hinge', 'bumble', 'other', 'unknown']),
  isOwnProfile: z.boolean(),
  bioText: z.string().default(''),
  prompts: z.array(z.object({ prompt: z.string(), answer: z.string() })).default([]),
  // Cuántas fotos de perfil vio (para pedirle al usuario que suba sus originales).
  photoCount: z.number().int().nonnegative().default(0),
  confidence: z.number().min(0).max(1),
});

export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;
