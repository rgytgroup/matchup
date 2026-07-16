import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { ReportResult } from '@matchup/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  create(submissionId: string, result: ReportResult) {
    return this.prisma.report.create({
      data: {
        submissionId,
        resultJson: result as unknown as Prisma.InputJsonValue,
        publicSlug: this.newSlug(),
      },
    });
  }

  setPdfUrl(id: string, pdfUrl: string) {
    return this.prisma.report.update({ where: { id }, data: { pdfUrl } });
  }

  /** Acceso público por slug, sin login (SPEC §4.4). */
  findBySlug(slug: string) {
    return this.prisma.report.findUnique({ where: { publicSlug: slug } });
  }

  private newSlug(): string {
    return randomUUID().replace(/-/g, '').slice(0, 16);
  }
}
