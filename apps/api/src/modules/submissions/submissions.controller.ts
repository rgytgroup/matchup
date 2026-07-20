import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { isTierId, UPLOAD_RULES } from '@matchup/shared';
import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../storage/storage.service';
import { OrdersService } from '../orders/orders.service';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
export class SubmissionsController {
  constructor(
    private readonly orders: OrdersService,
    private readonly submissions: SubmissionsService,
    private readonly storage: StorageService,
    private readonly events: EventsService,
  ) {}

  /** Intake (SPEC §4.2): crea orden PENDING, sube fotos y crea la Submission. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // subida cara: máx 5/min por IP
  @Post()
  @UseInterceptors(FilesInterceptor('photos', UPLOAD_RULES.maxPhotos))
  async create(
    @UploadedFiles() files: Array<Express.Multer.File> = [],
    @Body() body: { email?: string; tier?: string; bioText?: string; questionnaire?: string },
  ) {
    if (!body?.email || !body?.tier || !isTierId(body.tier)) {
      throw new BadRequestException('email y tier válidos son obligatorios');
    }
    this.validateFiles(files);

    const questionnaire = this.parseQuestionnaire(body.questionnaire);
    const order = await this.orders.createPending(body.email, body.tier);
    const paths = await this.storage.uploadPhotos(order.id, files);
    await this.submissions.create({
      orderId: order.id,
      questionnaire,
      bioText: body.bioText ?? '',
      photoUrls: paths,
    });

    await this.events.record('submission.created', {
      orderId: order.id,
      tier: body.tier,
      photos: files.length,
    });
    return { orderId: order.id, tier: body.tier };
  }

  private validateFiles(files: Array<Express.Multer.File>): void {
    if (files.length < UPLOAD_RULES.minPhotos || files.length > UPLOAD_RULES.maxPhotos) {
      throw new BadRequestException(
        `Sube entre ${UPLOAD_RULES.minPhotos} y ${UPLOAD_RULES.maxPhotos} fotos`,
      );
    }
    const accepted = UPLOAD_RULES.acceptedMimeTypes as readonly string[];
    for (const f of files) {
      if (!accepted.includes(f.mimetype)) {
        throw new BadRequestException(`Formato no permitido: ${f.mimetype}`);
      }
      if (f.size > UPLOAD_RULES.maxBytesPerPhoto) {
        throw new BadRequestException(`"${f.originalname}" supera el tamaño máximo`);
      }
    }
  }

  private parseQuestionnaire(raw?: string): Prisma.InputJsonValue {
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Prisma.InputJsonValue;
      }
      return {};
    } catch {
      throw new BadRequestException('questionnaire debe ser JSON válido');
    }
  }
}
