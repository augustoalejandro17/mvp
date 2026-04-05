import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { ImagesFacade } from '../services/images.facade';

@Controller('images')
export class ImagesController {
  constructor(
    private readonly imagesFacade: ImagesFacade,
  ) {}

  /**
   * Endpoint para refrescar URLs de imágenes expiradas
   * @param key La clave (path) de la imagen en S3
   * @returns URL firmada nueva
   */
  @Get('refresh-url')
  async refreshImageUrl(@Query('key') key: string): Promise<{ url: string }> {
    return this.imagesFacade.refreshImageUrl(key);
  }
}
