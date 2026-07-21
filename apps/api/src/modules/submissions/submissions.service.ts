import { Injectable } from '@nestjs/common';
import { Prisma, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: {
    orderId: string;
    questionnaire: Prisma.InputJsonValue;
    bioText: string;
    photoUrls: string[];
    platform?: string;
  }) {
    return this.prisma.submission.create({
      data: {
        orderId: input.orderId,
        intakeMode: 'MANUAL',
        platform: input.platform,
        questionnaire: input.questionnaire,
        bioText: input.bioText,
        photoUrls: input.photoUrls,
      },
    });
  }

  setStatus(id: string, status: SubmissionStatus) {
    return this.prisma.submission.update({ where: { id }, data: { status } });
  }

  /** Registra un fallo del pipeline (SPEC §11.3): +1 retryCount y guarda el último error. */
  recordError(id: string, message: string) {
    return this.prisma.submission.update({
      where: { id },
      data: { retryCount: { increment: 1 }, lastError: message.slice(0, 1000) },
    });
  }

  /** Limpia el estado de fallo antes de un reintento asistido (SPEC §11.4). */
  resetForRetry(id: string) {
    return this.prisma.submission.update({
      where: { id },
      data: { retryCount: 0, lastError: null },
    });
  }

  findByOrderId(orderId: string) {
    return this.prisma.submission.findUnique({ where: { orderId } });
  }
}
