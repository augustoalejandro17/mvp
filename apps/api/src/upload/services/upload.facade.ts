import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { S3Service } from '../../services/s3.service';

@Injectable()
export class UploadFacade {
  private readonly logger = new Logger(UploadFacade.name);

  constructor(private readonly s3Service: S3Service) {}

  async uploadImage(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No se ha proporcionado ningún archivo de imagen',
      );
    }

    try {
      const imageUrl = await this.s3Service.uploadImage(file);

      return {
        imageUrl,
        originalName: file.originalname,
        size: file.size,
        fileType: file.mimetype,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(
        `Error al subir la imagen: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
