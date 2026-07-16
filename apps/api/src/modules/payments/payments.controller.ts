import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { isTierId } from '@matchup/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../common/events/events.service';
import { OrdersService } from '../orders/orders.service';
import { AnalysisPipelineService } from '../analysis/analysis-pipeline.service';
import { StripeService } from './stripe.service';

@Controller()
export class PaymentsController {
  constructor(
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly pipeline: AnalysisPipelineService,
  ) {}

  /** Crea la orden PENDING y devuelve la URL de Stripe Checkout (SPEC §4.3). */
  @Post('checkout')
  async createCheckout(@Body() body: { email?: string; tier?: string }) {
    if (!body?.email || !body?.tier || !isTierId(body.tier)) {
      throw new BadRequestException('email y tier válidos son obligatorios');
    }
    const order = await this.orders.createPending(body.email, body.tier);
    const session = await this.stripe.createCheckoutSession({
      tier: body.tier,
      email: body.email,
      orderId: order.id,
    });
    await this.orders.attachStripeSession(order.id, session.id);
    await this.events.record('checkout.created', { orderId: order.id, tier: body.tier });
    return { url: session.url };
  }

  /** Webhook de Stripe. Idempotente: procesar el mismo evento 2x no duplica efectos (SPEC §8/§9). */
  @Post('webhooks/stripe')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('Falta el cuerpo crudo del webhook');

    const event = this.stripe.verifyEvent(req.rawBody, signature);

    // Guardia de idempotencia: insertar el event.id; si ya existía, salir sin efectos.
    try {
      await this.prisma.processedWebhook.create({ data: { stripeEventId: event.id } });
    } catch {
      return { received: true, duplicate: true };
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const order = await this.orders.markPaidBySession(session.id);
      await this.events.record('order.paid', { orderId: order.id });
      await this.pipeline.enqueue(order.id);
    }

    return { received: true };
  }
}
