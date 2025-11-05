import { Module } from '@nestjs/common';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';
import { FeatureExtractorService } from './services/feature-extractor.service';
import { DTWService } from './services/dtw.service';
import { CoachEngineService } from './services/coach-engine.service';
import { DatabaseModule } from '../db/db.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CoachController],
  providers: [
    CoachService,
    FeatureExtractorService,
    DTWService,
    CoachEngineService,
  ],
  exports: [CoachService],
})
export class CoachModule {}
