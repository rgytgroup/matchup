import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
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
})
export class AppModule {}
