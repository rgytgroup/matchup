import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import IORedis from 'ioredis';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './common/events/events.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PromptsModule } from './prompts/prompts.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DevModule } from './modules/dev/dev.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SentryModule.forRoot(),
    // Rate limit global: 60 req/min por IP (los endpoints sensibles lo ajustan).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    ScheduleModule.forRoot(),
    // Cola durable (BullMQ + Redis): el procesamiento sobrevive a reinicios.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: new IORedis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        }),
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 1000,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
    }),
    CleanupModule,
    // Endpoints de desarrollo: solo fuera de producción.
    ...(process.env.NODE_ENV === 'production' ? [] : [DevModule]),
    PrismaModule,
    EventsModule,
    StorageModule,
    NotificationsModule,
    PromptsModule,
    OrdersModule,
    SubmissionsModule,
    ExtractionModule,
    AnalysisModule,
    PhotosModule,
    ReportsModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
