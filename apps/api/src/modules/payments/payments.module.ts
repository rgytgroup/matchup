import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { PhotosModule } from '../photos/photos.module';
import { StripeService } from './stripe.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [OrdersModule, AnalysisModule, PhotosModule],
  controllers: [PaymentsController],
  providers: [StripeService],
})
export class PaymentsModule {}
