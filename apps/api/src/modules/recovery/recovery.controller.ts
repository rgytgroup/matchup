import {
  Controller,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { RecoveryService } from './recovery.service';

/** Recuperación asistida (SPEC §11.4): botón Retry del cliente + re-disparo de admin. */
@Controller()
export class RecoveryController {
  constructor(
    private readonly recovery: RecoveryService,
    private readonly config: ConfigService,
  ) {}

  /** Botón "Retry" del cliente: re-encola su propia orden si quedó en fallo. Idempotente. */
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('orders/:orderId/retry')
  retry(@Param('orderId') orderId: string) {
    return this.recovery.retry(orderId, { admin: false });
  }

  /** Re-disparo de admin (protegido con ADMIN_TOKEN): fuerza cualquier orden PAID. */
  @Post('admin/retrigger/:orderId')
  admin(@Param('orderId') orderId: string, @Headers('x-admin-token') token?: string) {
    const expected = this.config.get<string>('ADMIN_TOKEN');
    if (!expected || token !== expected) {
      throw new UnauthorizedException('Token de admin inválido');
    }
    return this.recovery.retry(orderId, { admin: true, force: true });
  }
}
