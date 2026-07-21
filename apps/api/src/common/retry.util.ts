/** Recuperación de fallos post-pago (SPEC §11). */

/** Máximo de intentos automáticos antes de pasar a NEEDS_ATTENTION (SPEC §11.3). */
export const MAX_PIPELINE_ATTEMPTS = 3;

/** Backoff exponencial base (ms) para los reintentos de la cola. */
export const RETRY_BACKOFF_MS = 20_000;

/**
 * ¿El error es transitorio y vale la pena reintentar? (429, timeouts, 5xx, etc.)
 * Los errores estructurales (schema inválido, foto corrupta) NO son transitorios:
 * reintentarlos quema créditos sin arreglar nada, así que van directo a NEEDS_ATTENTION.
 */
export function isTransientError(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? String(err)).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('throttl') ||
    msg.includes('quota') ||
    msg.includes('credits are depleted') ||
    msg.includes('timeout') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('500') ||
    msg.includes('504')
  );
}
