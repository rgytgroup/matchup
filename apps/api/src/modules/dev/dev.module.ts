import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { PhotosModule } from '../photos/photos.module';
import { DevController } from './dev.controller';

@Module({
  imports: [AnalysisModule, PhotosModule],
  controllers: [DevController],
})
export class DevModule {}
