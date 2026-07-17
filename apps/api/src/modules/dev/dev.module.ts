import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { DevController } from './dev.controller';

@Module({
  imports: [AnalysisModule],
  controllers: [DevController],
})
export class DevModule {}
