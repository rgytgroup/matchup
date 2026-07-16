import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { PromptLoaderService } from '../../prompts/prompt-loader.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { PHOTO_PROVIDER, type PhotoProvider } from './photo-provider.interface';

/** Pipeline de fotos del tier premium (SPEC §6). */
@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    @Inject(PHOTO_PROVIDER) private readonly provider: PhotoProvider,
    private readonly prompts: PromptLoaderService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventsService,
  ) {}

  /** Arranca el entrenamiento + generación para la orden (tras pago premium). */
  async startJob(orderId: string): Promise<void> {
    const submission = await this.prisma.submission.findUnique({ where: { orderId } });
    if (!submission) {
      this.logger.warn(`startJob: sin submission para la orden ${orderId}`);
      return;
    }

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
      const signedUrls = await this.storage.signUrls(submission.photoUrls, 3600);
      const training = await this.provider.train(signedUrls);
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
