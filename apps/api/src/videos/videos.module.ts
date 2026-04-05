import { Module } from '@nestjs/common';
import { VideosController } from '../controllers/videos.controller';
import { ClassesModule } from '../classes/classes.module';
import { ServicesModule } from '../services/services.module';
import { VideosFacade } from './services/videos.facade';

@Module({
  imports: [ClassesModule, ServicesModule],
  controllers: [VideosController],
  providers: [VideosFacade],
})
export class VideosModule {}
