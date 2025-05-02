import { Module } from '@nestjs/common';
import { VideoProcessorService } from './video-processor.service';
import { S3Service } from './s3.service';
import { CloudFrontService } from './cloudfront.service';
import { ConfigModule } from '@nestjs/config';
import awsConfig from '../config/aws.config';

@Module({
  imports: [
    ConfigModule.forFeature(awsConfig),
  ],
  providers: [
    VideoProcessorService,
    S3Service,
    CloudFrontService,
  ],
  exports: [
    VideoProcessorService,
    S3Service,
    CloudFrontService,
  ],
})
export class ServicesModule {} 