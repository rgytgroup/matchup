import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/** Endpoint de salud para health checks del PaaS (Railway) y verificación rápida. */
@SkipThrottle()
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { ok: true, service: 'matchup-api' };
  }
}
