import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { PHOTO_PROVIDER } from './photo-provider.interface';
import { ReplicatePhotoProvider } from './providers/replicate.provider';
import { PhotosService } from './photos.service';

@Module({
  imports: [AnalysisModule],
  providers: [PhotosService, { provide: PHOTO_PROVIDER, useClass: ReplicatePhotoProvider }],
  exports: [PhotosService],
})
export class PhotosModule {}
