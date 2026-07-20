import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { PhotosModule } from '../photos/photos.module';
import { CleanupModule } from '../../cleanup/cleanup.module';
import { DevController } from './dev.controller';

@Module({
  imports: [AnalysisModule, PhotosModule, CleanupModule],
  controllers: [DevController],
})
export class DevModule {}
