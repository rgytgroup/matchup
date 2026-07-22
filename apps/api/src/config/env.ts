import { z } from 'zod';

/**
 * Validación de variables de entorno (SPEC §7).
 * Solo DATABASE_URL es obligatoria para arrancar en dev; las claves de
 * terceros se validan de forma perezosa por cada proveedor cuando se usan,
 * para no bloquear el arranque local sin todas las integraciones.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  REPLICATE_API_TOKEN: z.string().default(''),
  // Entrenador LoRA, ej. "ostris/flux-dev-lora-trainer:<version>".
  REPLICATE_TRAINING_MODEL: z.string().default(''),
  // Modelo destino propio donde se guarda el LoRA entrenado, ej. "usuario/matchup-loras".
  REPLICATE_DESTINATION_MODEL: z.string().default(''),
  REPLICATE_TRAINING_STEPS: z.coerce.number().default(1000),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('Truly <onboarding@resend.dev>'),
  // Token para el endpoint de admin de re-disparo de órdenes (SPEC §11.4).
  ADMIN_TOKEN: z.string().default(''),
  // Puerta falsa de validación pre-lanzamiento (SPEC §12).
  FAKE_DOOR_ENABLED: z.coerce.boolean().default(false),
  PRICE_AB_ENABLED: z.coerce.boolean().default(false),
  SUPABASE_BUCKET: z.string().default('submissions'),
  // QC de fotos: umbral de parecido (0-100) para aceptar una foto generada.
  PHOTO_QC_THRESHOLD: z.coerce.number().default(70),
  // Imágenes generadas por escenario (SPEC §6.2 pide 40-60 en 6-8 escenarios).
  PHOTO_NUM_OUTPUTS: z.coerce.number().default(4),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
  // Orígenes CORS permitidos (coma-separado). Vacío = deriva de APP_BASE_URL + localhost.
  CORS_ORIGINS: z.string().default(''),
  // Redis para la cola durable (BullMQ). Ej. Upstash: rediss://...@...:6379
  REDIS_URL: z.string().default('redis://localhost:6379'),
  // Monitoreo de errores (Sentry). Vacío = desactivado.
  SENTRY_DSN: z.string().default(''),
  PORT: z.coerce.number().default(3000),
  ADMIN_ALERT_EMAIL: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    throw new Error(`Configuración de entorno inválida: ${JSON.stringify(fields)}`);
  }
  return parsed.data;
}
