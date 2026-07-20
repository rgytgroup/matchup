import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './common/events/events.module';
import { StorageModule } from './storage/storage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PromptsModule } from './prompts/prompts.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { PhotosModule } from './modules/photos/photos.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DevModule } from './modules/dev/dev.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Rate limit global: 60 req/min por IP (los endpoints sensibles lo ajustan).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    // Endpoints de desarrollo: solo fuera de producción.
    ...(process.env.NODE_ENV === 'production' ? [] : [DevModule]),
    PrismaModule,
    EventsModule,
    StorageModule,
    NotificationsModule,
    PromptsModule,
    OrdersModule,
    SubmissionsModule,
    AnalysisModule,
    PhotosModule,
    ReportsModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
