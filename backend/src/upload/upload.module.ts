import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { ServicesModule } from '../services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [UploadController],
})
export class UploadModule {}
