import { Controller, Get } from '@nestjs/common';

/** Endpoint de salud para health checks del PaaS (Railway) y verificación rápida. */
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { ok: true, service: 'matchup-api' };
  }
}
