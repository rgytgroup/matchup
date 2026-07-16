import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { PromptLoaderService } from '../../prompts/prompt-loader.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PHOTO_PROVIDER, type PhotoProvider } from './photo-provider.interface';

/** Pipeline de fotos del tier premium (SPEC §6). */
@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    @Inject(PHOTO_PROVIDER) private readonly provider: PhotoProvider,
    private readonly prompts: PromptLoaderService,
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async startJob(orderId: string, photoUrls: string[]): Promise<void> {
    const job = await this.prisma.photoJob.upsert({
      where: { orderId },
      update: { status: 'TRAINING' },
      create: {
        orderId,
        provider: 'replicate',
        status: 'TRAINING',
        outputUrls: [],
        acceptedUrls: [],
      },
    });

    try {
      const training = await this.provider.train(photoUrls);
      await this.prisma.photoJob.update({
        where: { id: job.id },
        data: { trainingId: training.trainingId, costUsd: training.costUsd, status: 'GENERATING' },
      });

      const scenarios = this.prompts.load('photo-scenarios');
      const generation = await this.provider.generate(training.trainingId, [scenarios]);
      await this.prisma.photoJob.update({
        where: { id: job.id },
        data: { outputUrls: generation.imageUrls, status: 'QC' },
      });

      // TODO(qc): pase de visión de parecido facial vs originales; descartar < umbral;
      // si quedan <20, regenerar una tanda; si sigue mal, alertar al admin (SPEC §6.3-6.4).
      await this.events.record('photos.generated', {
        orderId,
        count: generation.imageUrls.length,
      });
    } catch (err) {
      await this.prisma.photoJob.update({ where: { id: job.id }, data: { status: 'FAILED' } });
      await this.events.record('photos.failed', { orderId, error: (err as Error).message });
      this.logger.error(`PhotoJob FAILED (orden ${orderId}): ${(err as Error).message}`);
    }
  }
}
