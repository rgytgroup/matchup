import { geolocation, next } from '@vercel/edge';

/**
 * Edge Middleware de Vercel (SPEC §12.2.2): lee el país del visitante en el edge
 * y lo deja en la cookie `tc` para que el cliente lo mande en los eventos del embudo.
 * NUNCA se guarda la IP — solo el código de país. Degrada seguro: si no hay país,
 * simplemente no se pone la cookie y los eventos quedan sin país.
 */
export const config = {
  // Todas las páginas menos assets estáticos.
  matcher: '/((?!assets/|persona/|favicon).*)',
};

export default function middleware(request: Request): Response {
  const { country } = geolocation(request);
  const response = next();
  if (country) {
    response.headers.set('set-cookie', `tc=${country}; Path=/; Max-Age=86400; SameSite=Lax`);
  }
  return response;
}
