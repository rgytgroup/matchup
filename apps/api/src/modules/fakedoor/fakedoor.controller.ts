import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  Query,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { UPLOAD_RULES } from '@matchup/shared';
import { normalizeCountry } from '../../common/country.util';
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
    @Body() body: { source?: string; device?: string; country?: string },
    @Headers('x-vercel-ip-country') vercelCountry?: string,
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
      country: normalizeCountry(body.country) ?? normalizeCountry(vercelCountry),
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
      country?: string;
    },
    @Headers('x-vercel-ip-country') vercelCountry?: string,
  ) {
    this.assertEnabled();
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new BadRequestException('Email inválido');
    }

    const country = normalizeCountry(body.country) ?? normalizeCountry(vercelCountry);
    await this.prisma.lead.create({
      data: {
        email,
        teaserScore: Math.round(Number(body.teaserScore ?? 0)),
        priceShown: (body.priceShown ?? 14.99).toString(),
        variant: body.variant?.slice(0, 20) ?? null,
        source: body.source?.slice(0, 40) ?? null,
        country: country ?? null,
        submissionId: body.teaserId ?? null,
      },
    });
    await this.events.record('email_captured', {
      channel: 'web',
      variant: body.variant,
      source: body.source,
      priceShown: body.priceShown,
      country,
    });

    return { ok: true };
  }

  /** Vista de embudo (SPEC §12.2.3), protegida con ADMIN_TOKEN. Filtrable por fuente y país. */
  @Get('funnel')
  async funnel(
    @Headers('x-admin-token') token?: string,
    @Query('source') source?: string,
    @Query('country') country?: string,
  ) {
    const expected = this.config.get<string>('ADMIN_TOKEN');
    if (!expected || token !== expected) throw new UnauthorizedException('Token de admin inválido');

    const src = source?.trim() || undefined;
    const ctry = normalizeCountry(country);

    const steps = ['visit', 'teaser_viewed', 'unlock_clicked', 'email_captured'];
    const counts: Record<string, number> = {};
    for (const s of steps) {
      counts[s] = await this.prisma.event.count({ where: this.eventWhere(s, src, ctry) });
    }
    const leads = await this.prisma.lead.count({ where: { source: src, country: ctry } });

    const pct = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : 0);
    return {
      filters: { source: src ?? null, country: ctry ?? null },
      counts,
      leads,
      conversion: {
        intake: pct(counts.teaser_viewed, counts.visit), // completitud del intake
        intent: pct(counts.unlock_clicked, counts.visit), // intención de compra (clave)
        capture: pct(counts.email_captured, counts.unlock_clicked), // captura del modal
      },
    };
  }

  /** Filtro de eventos por tipo + metadatos JSON (fuente/país) para el embudo. */
  private eventWhere(type: string, source?: string, country?: string): Prisma.EventWhereInput {
    const AND: Prisma.EventWhereInput[] = [];
    if (source) AND.push({ meta: { path: ['source'], equals: source } });
    if (country) AND.push({ meta: { path: ['country'], equals: country } });
    return AND.length ? { type, AND } : { type };
  }
}
