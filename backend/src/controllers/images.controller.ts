import { Controller, Get, Query, Logger } from '@nestjs/common';
import { S3Service } from '../services/s3.service';
import { CloudFrontService } from '../services/cloudfront.service';

@Controller('images')
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly cloudFrontService: CloudFrontService
  ) {}

  /**
   * Endpoint para refrescar URLs de imágenes expiradas
   * @param key La clave (path) de la imagen en S3
   * @returns URL firmada nueva
   */
  @Get('refresh-url')
  async refreshImageUrl(@Query('key') key: string): Promise<{ url: string }> {
    this.logger.log(`Solicitud de refresco de URL para imagen con key: ${key}`);
    
    if (!key) {
      this.logger.warn('Solicitud de refresco sin key');
      throw new Error('Se requiere el parámetro "key"');
    }
    
    try {
      // Priorizar CloudFront si está disponible (igual que para videos)
      if (this.cloudFrontService) {
        try {
          // Generar URL firmada de CloudFront con expiración de 24 horas
          const cloudFrontUrl = await this.cloudFrontService.getSignedUrl(key, 86400);
          this.logger.log(`URL CloudFront generada exitosamente para: ${key}`);
          return { url: cloudFrontUrl };
        } catch (cloudFrontError) {
          this.logger.warn(`Error con CloudFront: ${cloudFrontError.message}. Fallback a S3.`);
        }
      }
      
      // Fallback a S3 si CloudFront no está disponible
      const signedUrl = await this.s3Service.getSignedUrl(key, 86400);
      this.logger.log(`URL S3 refrescada generada exitosamente para: ${key}`);
      
      return { url: signedUrl };
    } catch (error) {
      this.logger.error(`Error al refrescar URL de imagen: ${error.message}`, error.stack);
      throw error;
    }
  }
} 