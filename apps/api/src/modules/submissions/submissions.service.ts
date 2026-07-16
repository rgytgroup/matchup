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
  }) {
    return this.prisma.submission.create({
      data: {
        orderId: input.orderId,
        questionnaire: input.questionnaire,
        bioText: input.bioText,
        photoUrls: input.photoUrls,
      },
    });
  }

  setStatus(id: string, status: SubmissionStatus) {
    return this.prisma.submission.update({ where: { id }, data: { status } });
  }

  findByOrderId(orderId: string) {
    return this.prisma.submission.findUnique({ where: { orderId } });
  }
}
