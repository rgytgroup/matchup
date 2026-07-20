import { Injectable, Logger } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { EmailService } from '../../notifications/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PhotosService } from '../photos/photos.service';

/**
 * Maneja reembolsos (SPEC §8): marca la orden REFUNDED y DETIENE cualquier job activo
 * (análisis en curso y entrenamiento de fotos en Replicate). Se dispara desde el
 * webhook `charge.refunded` (reembolso hecho desde el dashboard de Stripe).
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly orders: OrdersService,
    private readonly photos: PhotosService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly events: EventsService,
  ) {}

  async handleRefund(paymentIntentId: string): Promise<void> {
    const order = await this.orders.markRefundedByPaymentIntent(paymentIntentId);
    if (!order) {
      this.logger.warn(`Reembolso sin orden para payment_intent ${paymentIntentId}`);
      return;
    }

    // Detener análisis en curso (soft-stop).
    await this.prisma.submission.updateMany({
      where: { orderId: order.id, status: { in: ['UPLOADED', 'ANALYZING'] } },
      data: { status: 'FAILED' },
    });
    // Detener/cancelar el job de fotos (incluye cancelar el training en Replicate).
    await this.photos.cancelJob(order.id);

    await this.events.record('order.refunded', { orderId: order.id });
    await this.email.sendRefund(order.user.email).catch((e) => {
      this.logger.warn(`No se pudo enviar email de reembolso: ${(e as Error).message}`);
    });
  }
}
