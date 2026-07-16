import { Module } from '@nestjs/common';
import { PHOTO_PROVIDER } from './photo-provider.interface';
import { ReplicatePhotoProvider } from './providers/replicate.provider';
import { PhotosService } from './photos.service';

@Module({
  providers: [PhotosService, { provide: PHOTO_PROVIDER, useClass: ReplicatePhotoProvider }],
  exports: [PhotosService],
})
export class PhotosModule {}
