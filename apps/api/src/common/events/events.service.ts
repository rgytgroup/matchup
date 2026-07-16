import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Analítica interna mínima (SPEC §3). Nunca registrar secretos ni PII innecesaria. */
@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(type: string, meta?: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.event.create({ data: { type, meta } });
  }
}
