import { Injectable } from '@nestjs/common';
import { Tier } from '@prisma/client';
import { TIERS, type TierId } from '@matchup/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea (o reutiliza) el usuario por email y abre una orden PENDING. */
  async createPending(email: string, tier: TierId) {
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });
    return this.prisma.order.create({
      data: {
        userId: user.id,
        tier: tier as Tier,
        amountUsd: TIERS[tier].priceUsd,
      },
    });
  }

  attachStripeSession(orderId: string, stripeSessionId: string) {
    return this.prisma.order.update({ where: { id: orderId }, data: { stripeSessionId } });
  }

  markPaidBySession(stripeSessionId: string, paymentIntentId?: string) {
    return this.prisma.order.update({
      where: { stripeSessionId },
      data: { status: 'PAID', stripePaymentIntentId: paymentIntentId },
    });
  }

  markRefunded(orderId: string) {
    return this.prisma.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
  }

  /** Marca REFUNDED por el payment_intent del reembolso; devuelve la orden (con usuario) o null. */
  async markRefundedByPaymentIntent(paymentIntentId: string) {
    const order = await this.prisma.order.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { user: true },
    });
    if (!order) return null;
    await this.prisma.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
    return order;
  }

  findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { submission: true, photoJob: true, user: true },
    });
  }
}
