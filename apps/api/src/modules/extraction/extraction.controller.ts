import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { isTierId, UPLOAD_RULES } from '@matchup/shared';
import { ExtractionPipelineService } from './extraction-pipeline.service';

@Controller('submissions')
export class ExtractionController {
  constructor(private readonly extraction: ExtractionPipelineService) {}

  /** Intake screenshot-first (SPEC §4.2/§5.0): sube screenshots y arranca la extracción. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('extract')
  @UseInterceptors(FilesInterceptor('screenshots', 10))
  async extract(
    @UploadedFiles() files: Array<Express.Multer.File> = [],
    @Body() body: { email?: string; tier?: string },
  ) {
    if (!body?.email || !body?.tier || !isTierId(body.tier)) {
      throw new BadRequestException('email y tier válidos son obligatorios');
    }
    if (files.length < 1 || files.length > 10) {
      throw new BadRequestException('Sube entre 1 y 10 screenshots');
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
    return this.extraction.startExtraction(body.email, body.tier, files);
  }

  /**
   * Confirmación editable (SPEC §4.2 paso 2): la fuente de verdad para el análisis.
   * Enfoque híbrido (C): el usuario sube aquí sus FOTOS ORIGINALES (alta resolución).
   */
  @Post(':orderId/confirm')
  @UseInterceptors(FilesInterceptor('photos', UPLOAD_RULES.maxPhotos))
  async confirm(
    @Param('orderId') orderId: string,
    @UploadedFiles() files: Array<Express.Multer.File> = [],
    @Body() body: { platform?: string; bioText?: string; prompts?: string; questionnaire?: string },
  ) {
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
    return this.extraction.confirm(
      orderId,
      {
        platform: body.platform,
        bioText: body.bioText,
        prompts: this.safeJson(body.prompts),
        questionnaire: this.safeJson(body.questionnaire),
      },
      files,
    );
  }

  private safeJson<T>(raw?: string): T | undefined {
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }
}
