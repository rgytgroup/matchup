import 'dotenv/config'; // carga .env en local (en Railway usa las env vars reales)
import * as Sentry from '@sentry/nestjs';

// Se importa de PRIMERO en main.ts para que Sentry instrumente todo.
// Si no hay SENTRY_DSN, queda desactivado (no-op).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}
