import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ReportsModule } from '../reports/reports.module';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { StatusController } from './status.controller';

@Module({
  imports: [OrdersModule, ReportsModule],
  controllers: [SubmissionsController, StatusController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
