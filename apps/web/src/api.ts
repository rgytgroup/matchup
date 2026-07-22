import type { ReportResult } from '@matchup/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Metadatos del embudo (SPEC §12.2.2): fuente/UTM y dispositivo. */
function funnelMeta(): { source?: string; device: string } {
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source') ?? params.get('source') ?? undefined;
  const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  return { source, device };
}

/** Registra un evento de conversión (fire-and-forget, no bloquea la UI). */
export function track(type: string, extra?: { variant?: string }): void {
  void fetch(`${API_URL}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...funnelMeta(), ...extra }),
  }).catch(() => undefined);
}

/** Config pública (modo puerta falsa / A-B de precio). SPEC §12. */
export async function getConfig(): Promise<{ fakeDoor: boolean; priceAb: boolean }> {
  try {
    return await parse(await fetch(`${API_URL}/config`));
  } catch {
    return { fakeDoor: false, priceAb: false };
  }
}

/** Teaser gratuito de la puerta falsa: sube screenshots → score + fortaleza + #problemas. */
export async function postTeaser(
  form: FormData,
): Promise<{ teaserId: string; score: number; strength: string; problemCount: number; photoCount: number }> {
  return parse(await fetch(`${API_URL}/teaser`, { method: 'POST', body: form }));
}

/** Captura de correo (nunca cobra). SPEC §12.1.3. */
export async function postLead(data: {
  email: string;
  teaserId?: string;
  teaserScore: number;
  priceShown: number;
  variant?: string;
  source?: string;
}): Promise<{ ok: boolean }> {
  return parse(
    await fetch(`${API_URL}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  );
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Crea la orden + submission con las fotos (multipart). Devuelve el orderId. */
export async function createSubmission(form: FormData): Promise<{ orderId: string; tier: string }> {
  return parse(await fetch(`${API_URL}/submissions`, { method: 'POST', body: form }));
}

/** Intake screenshot-first: sube screenshots y arranca la extracción (SPEC §5.0). */
export async function startExtraction(form: FormData): Promise<{ orderId: string }> {
  return parse(await fetch(`${API_URL}/submissions/extract`, { method: 'POST', body: form }));
}

/** Perfil extraído por Gemini desde los screenshots (o motivo de fallo). */
export interface ExtractedProfile {
  platform?: string;
  isOwnProfile?: boolean;
  bioText?: string;
  prompts?: Array<{ prompt: string; answer: string }>;
  photoCount?: number;
  confidence?: number;
  reason?: string;
  message?: string;
}

/** Confirma/corrige lo extraído y sube las FOTOS ORIGINALES (multipart, enfoque híbrido). */
export async function confirmExtraction(
  orderId: string,
  form: FormData,
): Promise<{ ok: boolean }> {
  return parse(
    await fetch(`${API_URL}/submissions/${orderId}/confirm`, { method: 'POST', body: form }),
  );
}

/** Crea la sesión de Stripe Checkout para una orden y devuelve la URL de pago. */
export async function createCheckout(orderId: string): Promise<{ url: string }> {
  return parse(
    await fetch(`${API_URL}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    }),
  );
}

export async function getStatus(orderId: string): Promise<{
  status: string;
  intakeMode: string;
  platform: string | null;
  extractedProfile: ExtractedProfile | null;
  reportSlug: string | null;
  tier: string | null;
  photosJobStatus: string | null;
}> {
  return parse(await fetch(`${API_URL}/status/${orderId}`));
}

/** Reintento asistido del cliente (SPEC §11.4): re-encola lo que falló, sin re-cobro. */
export async function retryOrder(orderId: string): Promise<{ ok: boolean; actions: string[] }> {
  return parse(await fetch(`${API_URL}/orders/${orderId}/retry`, { method: 'POST' }));
}

export type PhotosStatus = 'NONE' | 'PROCESSING' | 'READY' | 'FAILED';

export async function getReport(slug: string): Promise<{
  slug: string;
  result: ReportResult;
  pdfUrl: string | null;
  photos: string[];
  photosStatus: PhotosStatus;
  createdAt: string;
}> {
  return parse(await fetch(`${API_URL}/report/${slug}`));
}
