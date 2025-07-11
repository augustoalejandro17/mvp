import {
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { S3Service } from '../services/s3.service';

@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly s3Service: S3Service) {}

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, callback) => {
        // Validar tipo de archivo
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|jpg|webp)$/)) {
          return callback(
            new BadRequestException(
              'Formato de archivo no soportado. Se admiten solamente imágenes (JPEG, PNG, GIF, WEBP).',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req) {
    if (!file) {
      throw new BadRequestException(
        'No se ha proporcionado ningún archivo de imagen',
      );
    }

    try {
      const imageUrl = await this.s3Service.uploadImage(file);

      // Log de la URL generada para depuración

      // Añadir información adicional que puede ser útil para el cliente
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
