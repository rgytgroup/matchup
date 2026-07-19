import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true es necesario para verificar la firma de los webhooks de Stripe.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  // 0.0.0.0 es necesario para que Railway (y otros PaaS) enruten el tráfico.
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API de MatchUp escuchando en el puerto ${port}`);
}

void bootstrap();
