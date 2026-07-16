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

  markPaidBySession(stripeSessionId: string) {
    return this.prisma.order.update({ where: { stripeSessionId }, data: { status: 'PAID' } });
  }

  markRefunded(orderId: string) {
    return this.prisma.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
  }

  findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { submission: true, photoJob: true, user: true },
    });
  }
}
