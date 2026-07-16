import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { TIERS, type TierId } from '@matchup/shared';

@Injectable()
export class StripeService {
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): Stripe {
    if (this.client) return this.client;
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY no configurada');
    this.client = new Stripe(key);
    return this.client;
  }

  /** Verifica la firma del webhook usando el cuerpo crudo (obligatorio para seguridad). */
  verifyEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET no configurada');
    return this.getClient().webhooks.constructEvent(rawBody, signature, secret);
  }

  async createCheckoutSession(params: {
    tier: TierId;
    email: string;
    orderId: string;
  }): Promise<Stripe.Checkout.Session> {
    const base = this.config.get<string>('APP_BASE_URL');
    const tier = TIERS[params.tier];
    const productName =
      params.tier === 'AUDIT_PLUS_PHOTOS' ? 'MatchUp — Audit + AI Photos' : 'MatchUp — Profile Audit';

    return this.getClient().checkout.sessions.create({
      mode: 'payment',
      customer_email: params.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(tier.priceUsd * 100),
            product_data: { name: productName },
          },
        },
      ],
      // metadata para reconciliar el pago con nuestra orden.
      metadata: { orderId: params.orderId, tier: params.tier },
      success_url: `${base}/status/${params.orderId}`,
      cancel_url: `${base}/checkout?canceled=1`,
    });
  }
}
