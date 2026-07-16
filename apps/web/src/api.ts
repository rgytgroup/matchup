import type { ReportResult } from '@matchup/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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

export async function getStatus(
  orderId: string,
): Promise<{ status: string; reportSlug: string | null }> {
  return parse(await fetch(`${API_URL}/status/${orderId}`));
}

export async function getReport(slug: string): Promise<{
  slug: string;
  result: ReportResult;
  pdfUrl: string | null;
  createdAt: string;
}> {
  return parse(await fetch(`${API_URL}/report/${slug}`));
}
