import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

/** Orígenes permitidos por CORS: CORS_ORIGINS (coma-separado) o, si no, APP_BASE_URL + localhost dev. */
function allowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  const origins = ['http://localhost:5173'];
  if (process.env.APP_BASE_URL) origins.push(process.env.APP_BASE_URL);
  return origins;
}

async function bootstrap() {
  // rawBody: true es necesario para verificar la firma de los webhooks de Stripe.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Railway/Vercel están detrás de proxy: confiar en X-Forwarded-* para obtener la IP real (rate limit).
  app.set('trust proxy', 1);
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API de MatchUp escuchando en el puerto ${port}`);
}

void bootstrap();
