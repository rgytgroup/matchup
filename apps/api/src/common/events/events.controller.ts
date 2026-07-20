import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventsService } from './events.service';

/** Tipos de evento de cliente permitidos (allowlist para evitar spam de eventos). */
const ALLOWED_TYPES = new Set([
  'landing.visit',
  'pricing.viewed',
  'start.viewed',
  'checkout.viewed',
]);

/** Registro de eventos de conversión enviados desde el frontend (SPEC §9). */
@Controller('track')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  async track(@Body() body: { type?: string }) {
    if (body?.type && ALLOWED_TYPES.has(body.type)) {
      await this.events.record(body.type, { source: 'web' });
    }
    // Siempre 200: un evento inválido no debe romper nada en el cliente.
    return { ok: true };
  }
}
