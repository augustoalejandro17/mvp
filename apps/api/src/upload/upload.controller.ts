import {
  Controller,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadFacade } from './services/upload.facade';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadFacade: UploadFacade,
  ) {}

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
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadFacade.uploadImage(file);
  }
}
