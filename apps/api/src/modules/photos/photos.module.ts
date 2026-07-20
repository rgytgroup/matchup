import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnalysisModule } from '../analysis/analysis.module';
import { PHOTOS_QUEUE } from '../../queue/queue.constants';
import { PHOTO_PROVIDER } from './photo-provider.interface';
import { ReplicatePhotoProvider } from './providers/replicate.provider';
import { PhotosService } from './photos.service';
import { PhotosProcessor } from './photos.processor';

@Module({
  imports: [AnalysisModule, BullModule.registerQueue({ name: PHOTOS_QUEUE })],
  providers: [
    PhotosService,
    PhotosProcessor,
    { provide: PHOTO_PROVIDER, useClass: ReplicatePhotoProvider },
  ],
  exports: [PhotosService],
})
export class PhotosModule {}
