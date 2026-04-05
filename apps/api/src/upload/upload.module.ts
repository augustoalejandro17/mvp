import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { ServicesModule } from '../services/services.module';
import { UploadFacade } from './services/upload.facade';

@Module({
  imports: [ServicesModule],
  controllers: [UploadController],
  providers: [UploadFacade],
})
export class UploadModule {}
