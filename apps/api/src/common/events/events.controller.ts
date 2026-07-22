import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventsService } from './events.service';

/** Tipos de evento de cliente permitidos (allowlist para evitar spam de eventos). */
const ALLOWED_TYPES = new Set([
  'landing.visit',
  'pricing.viewed',
  'start.viewed',
  'checkout.viewed',
  // Embudo de la puerta falsa (SPEC §12.2.1).
  'visit',
  'teaser_viewed',
  'unlock_clicked',
  'email_captured',
]);

/** Registro de eventos de conversión enviados desde el frontend (SPEC §9). */
@Controller('track')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  async track(
    @Body() body: { type?: string; source?: string; variant?: string; device?: string },
  ) {
    if (body?.type && ALLOWED_TYPES.has(body.type)) {
      // Metadatos del embudo (SPEC §12.2.2): utm/canal, variante de precio, dispositivo.
      await this.events.record(body.type, {
        channel: 'web',
        source: body.source?.slice(0, 40),
        variant: body.variant?.slice(0, 20),
        device: body.device?.slice(0, 20),
      });
    }
    // Siempre 200: un evento inválido no debe romper nada en el cliente.
    return { ok: true };
  }
}
