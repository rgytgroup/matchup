import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { FakeDoorController } from './fakedoor.controller';

@Module({
  imports: [StorageModule, AnalysisModule],
  controllers: [FakeDoorController],
})
export class FakeDoorModule {}
