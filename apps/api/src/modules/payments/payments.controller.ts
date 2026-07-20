import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../common/events/events.service';
import { OrdersService } from '../orders/orders.service';
import { AnalysisPipelineService } from '../analysis/analysis-pipeline.service';
import { PhotosService } from '../photos/photos.service';
import { StripeService } from './stripe.service';

@Controller()
export class PaymentsController {
  constructor(
    private readonly stripe: StripeService,
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly pipeline: AnalysisPipelineService,
    private readonly photos: PhotosService,
  ) {}

  /** Crea la sesión de Stripe Checkout para una orden ya existente (SPEC §4.3). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout')
  async createCheckout(@Body() body: { orderId?: string }) {
    if (!body?.orderId) throw new BadRequestException('orderId es obligatorio');
    const order = await this.orders.findById(body.orderId);
    if (!order) throw new NotFoundException('Orden no encontrada');

    const session = await this.stripe.createCheckoutSession({
      tier: order.tier,
      email: order.user.email,
      orderId: order.id,
    });
    await this.orders.attachStripeSession(order.id, session.id);
    await this.events.record('checkout.created', { orderId: order.id, tier: order.tier });
    return { url: session.url };
  }

  /** Webhook de Stripe. Idempotente: procesar el mismo evento 2x no duplica efectos (SPEC §8/§9). */
  @SkipThrottle() // Stripe (servidor-a-servidor) puede reintentar; no lo limitamos.
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
      if (order.tier === 'AUDIT_PLUS_PHOTOS') {
        void this.photos.startJob(order.id).catch(() => undefined);
      }
    }

    return { received: true };
  }
}
