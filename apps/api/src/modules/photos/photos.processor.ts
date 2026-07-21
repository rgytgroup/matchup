import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PHOTOS_QUEUE } from '../../queue/queue.constants';
import { PhotosService } from './photos.service';

/** Worker que consume la cola de fotos (durable; reanuda entrenamientos tras reinicio). */
@Processor(PHOTOS_QUEUE, { concurrency: 2 })
export class PhotosProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotosProcessor.name);

  constructor(private readonly photos: PhotosService) {
    super();
  }

  async process(job: Job<{ orderId: string }>): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;
    this.logger.log(
      `Procesando fotos de la orden ${job.data.orderId} (intento ${job.attemptsMade + 1}/${maxAttempts})`,
    );
    await this.photos.startJob(job.data.orderId, isLastAttempt);
  }
}
