import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { UPLOAD_RULES } from '@matchup/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../storage/storage.service';
import { AnalysisService } from '../analysis/analysis.service';

/**
 * Puerta falsa de validación pre-lanzamiento (SPEC §12).
 * Teaser gratis desde screenshots → precio → captura de correo (sin cobrar).
 * Todo detrás del flag FAKE_DOOR_ENABLED.
 */
@Controller()
export class FakeDoorController {
  constructor(
    private readonly analysis: AnalysisService,
    private readonly storage: StorageService,
    private readonly events: EventsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private assertEnabled(): void {
    if (!this.config.get<boolean>('FAKE_DOOR_ENABLED')) {
      throw new NotFoundException('No disponible');
    }
  }

  /** Config pública para el front: modo puerta falsa y A/B de precio. */
  @Get('config')
  config_(): { fakeDoor: boolean; priceAb: boolean } {
    return {
      fakeDoor: !!this.config.get<boolean>('FAKE_DOOR_ENABLED'),
      priceAb: !!this.config.get<boolean>('PRICE_AB_ENABLED'),
    };
  }

  /** Teaser gratuito (SPEC §12.1.1): sube screenshots → score + fortaleza + #problemas. */
  @Throttle({ default: { limit: 4, ttl: 60_000 } }) // análisis gratis: máx 4/min por IP (anti-abuso §12.3)
  @Post('teaser')
  @UseInterceptors(FilesInterceptor('screenshots', 10))
  async teaser(
    @UploadedFiles() files: Array<Express.Multer.File> = [],
    @Body() body: { source?: string; device?: string },
  ) {
    this.assertEnabled();
    if (files.length < 1 || files.length > 10) {
      throw new BadRequestException('Sube entre 1 y 10 screenshots');
    }
    const accepted = UPLOAD_RULES.acceptedMimeTypes as readonly string[];
    for (const f of files) {
      if (!accepted.includes(f.mimetype)) throw new BadRequestException(`Formato no permitido: ${f.mimetype}`);
      if (f.size > UPLOAD_RULES.maxBytesPerPhoto) throw new BadRequestException(`"${f.originalname}" supera el tamaño máximo`);
    }

    const teaserId = randomUUID();
    const paths = await this.storage.uploadFiles(`teasers/${teaserId}`, files);
    const signed = await this.storage.signUrls(paths, 3600);
    const result = await this.analysis.teaser(signed);

    await this.events.record('teaser_viewed', {
      channel: 'web',
      teaserId,
      score: result.score,
      source: body.source?.slice(0, 40),
      device: body.device?.slice(0, 20),
    });

    return { teaserId, ...result };
  }

  /** Captura de correo tras el clic de intención (SPEC §12.1.3). NUNCA cobra. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('leads')
  async lead(
    @Body()
    body: {
      email?: string;
      teaserId?: string;
      teaserScore?: number;
      priceShown?: number;
      variant?: string;
      source?: string;
    },
  ) {
    this.assertEnabled();
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException('Email inválido');
    }

    await this.prisma.lead.create({
      data: {
        email,
        teaserScore: Math.round(Number(body.teaserScore ?? 0)),
        priceShown: (body.priceShown ?? 14.99).toString(),
        variant: body.variant?.slice(0, 20) ?? null,
        source: body.source?.slice(0, 40) ?? null,
        submissionId: body.teaserId ?? null,
      },
    });
    await this.events.record('email_captured', {
      channel: 'web',
      variant: body.variant,
      source: body.source,
      priceShown: body.priceShown,
    });

    return { ok: true };
  }

  /** Vista de embudo (SPEC §12.2.3), protegida con ADMIN_TOKEN. */
  @Get('funnel')
  async funnel(@Headers('x-admin-token') token?: string) {
    const expected = this.config.get<string>('ADMIN_TOKEN');
    if (!expected || token !== expected) throw new UnauthorizedException('Token de admin inválido');

    const steps = ['visit', 'teaser_viewed', 'unlock_clicked', 'email_captured'];
    const counts: Record<string, number> = {};
    for (const s of steps) counts[s] = await this.prisma.event.count({ where: { type: s } });
    const leads = await this.prisma.lead.count();

    const pct = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : 0);
    return {
      counts,
      leads,
      conversion: {
        intake: pct(counts.teaser_viewed, counts.visit), // completitud del intake
        intent: pct(counts.unlock_clicked, counts.visit), // intención de compra (clave)
        capture: pct(counts.email_captured, counts.unlock_clicked), // captura del modal
      },
    };
  }
}
