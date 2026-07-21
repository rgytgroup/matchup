import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { PhotosModule } from '../photos/photos.module';
import { RecoveryService } from './recovery.service';
import { RecoveryController } from './recovery.controller';

@Module({
  imports: [AnalysisModule, PhotosModule],
  controllers: [RecoveryController],
  providers: [RecoveryService],
})
export class RecoveryModule {}
