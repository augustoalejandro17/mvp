import { Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { AnalysisEngineService } from './services/analysis-engine.service';
import { DatabaseModule } from '../db/db.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisEngineService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
