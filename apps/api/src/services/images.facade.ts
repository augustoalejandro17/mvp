import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { CloudFrontService } from './cloudfront.service';
import { S3Service } from './s3.service';

@Injectable()
export class ImagesFacade {
  private readonly logger = new Logger(ImagesFacade.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly cloudFrontService: CloudFrontService,
  ) {}

  async refreshImageUrl(key: string): Promise<{ url: string }> {
    if (!key) {
      throw new BadRequestException('Se requiere el parámetro "key"');
    }

    try {
      if (this.cloudFrontService) {
        try {
          const cloudFrontUrl = await this.cloudFrontService.getSignedUrl(
            key,
            86400,
          );
          return { url: cloudFrontUrl };
        } catch {}
      }

      const signedUrl = await this.s3Service.getSignedUrl(key, 86400);
      return { url: signedUrl };
    } catch (error) {
      this.logger.error(
        `Error al refrescar URL de imagen: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
