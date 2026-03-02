import { Module } from '@nestjs/common';
import { VideosController } from '../controllers/videos.controller';
import { ClassesModule } from '../classes/classes.module';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ClassesModule, ServicesModule],
  controllers: [VideosController],
})
export class VideosModule {}
