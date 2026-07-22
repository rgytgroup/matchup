/** Normaliza un código de país ISO-3166-1 alpha-2 (SPEC §12.2.2). NUNCA se guarda la IP. */
export function normalizeCountry(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : undefined;
}
