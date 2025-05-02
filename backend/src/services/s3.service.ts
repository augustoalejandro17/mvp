import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly s3: S3;
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('aws.accessKeyId'),
      secretAccessKey: this.configService.get<string>('aws.secretAccessKey'),
      region: this.configService.get<string>('aws.region'),
    });
    this.bucketName = this.configService.get<string>('aws.s3.bucketName');
    this.logger.log(`S3Service inicializado con bucket: ${this.bucketName}`);
  }

  async uploadVideo(file: Express.Multer.File): Promise<string> {
    try {
      this.logger.log(`Intentando subir video a S3: ${file.originalname}`);
      const fileExtension = file.originalname.split('.').pop();
      const key = `videos/${uuidv4()}.${fileExtension}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: 'video/mp4',
        // Añadir metadatos para evitar problemas de orientación
        Metadata: {
          'x-amz-meta-orientation': 'normal',
          'x-amz-meta-video-rotation': '0',
          'x-amz-meta-video-transform': 'none',
          'x-amz-meta-video-display': 'inline'
        },
        // Forzar compatibilidad
        ContentDisposition: 'inline',
        // Configurar cache para mejorar rendimiento
        CacheControl: 'max-age=31536000',
        // Asegurar que el contenido es tratado como video MP4
        ContentEncoding: 'identity'
      };

      this.logger.log(`Parámetros de carga: bucket=${this.bucketName}, key=${key}, contentType=video/mp4`);
      
      const uploadResult = await this.s3.upload(uploadParams).promise();

      this.logger.log(`Video uploaded successfully to ${uploadResult.Location}`);
      
      // Devolvemos solo la URL de S3 sin firmar
      return uploadResult.Location;
    } catch (error) {
      this.logger.error('Error uploading video to S3:', error);
      throw error;
    }
  }

  /**
   * Genera una URL firmada para acceder a un archivo en S3
   * @param key La clave del objeto en S3
   * @param expiresIn Tiempo de expiración en segundos
   * @returns URL firmada
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // Asegurarnos de que tenemos una key válida
    if (!key) {
      this.logger.error('getSignedUrl: Se intentó generar una URL para una key vacía');
      throw new Error('La clave del objeto S3 no puede estar vacía');
    }

    // Limpiar la key si viene con la URL completa
    let cleanKey = key;
    if (key.includes('amazonaws.com')) {
      cleanKey = this.getKeyFromUrl(key);
      this.logger.log(`Se extrajo la key ${cleanKey} de la URL ${key}`);
    }

    const params = {
      Bucket: this.bucketName,
      Key: cleanKey,
      Expires: expiresIn,
      ResponseContentType: 'video/mp4',
      ResponseCacheControl: 'max-age=3600'
      // No incluimos ResponseContentDisposition para permitir la visualización en el navegador
    };

    try {
      this.logger.log(`Generando URL firmada para S3. Bucket: ${this.bucketName}, Key: ${cleanKey}`);
      const url = await this.s3.getSignedUrlPromise('getObject', params);
      this.logger.log(`URL firmada generada exitosamente (longitud: ${url.length})`);
      return url;
    } catch (error) {
      this.logger.error(`Error al generar URL firmada: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteVideo(videoUrl: string): Promise<void> {
    try {
      const key = this.getKeyFromUrl(videoUrl);
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: key,
      }).promise();

      this.logger.log(`Video deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error('Error deleting video from S3:', error);
      throw error;
    }
  }

  public getKeyFromUrl(url: string): string {
    try {
      this.logger.log(`Procesando URL para extraer key: ${url}`);
      
      // Si la URL contiene parámetros de consulta, los eliminamos
      let cleanUrl = url;
      if (url.includes('?')) {
        cleanUrl = url.split('?')[0];
        this.logger.log(`URL limpia (sin parámetros): ${cleanUrl}`);
      }
      
      try {
        // Intento parsear la URL
        const urlObj = new URL(cleanUrl);
        
        // La estructura típica de la URL de S3 es:
        // 1. https://bucket-name.s3.region.amazonaws.com/path/to/object
        // 2. https://s3.region.amazonaws.com/bucket-name/path/to/object
        
        const hostname = urlObj.hostname;
        let pathname = urlObj.pathname;
        if (pathname.startsWith('/')) {
          pathname = pathname.substring(1);
        }
        
        this.logger.log(`URL parseada: hostname=${hostname}, pathname=${pathname}`);
        
        // Caso 1: URL en formato bucket-name.s3.region.amazonaws.com
        if (hostname.includes(this.bucketName)) {
          this.logger.log(`Caso 1: URL con formato bucket-name.s3.region... - key extraída: ${pathname}`);
          return pathname;
        }
        
        // Caso 2: URL en formato s3.region.amazonaws.com/bucket-name
        if (hostname.includes('s3.amazonaws.com')) {
          const pathParts = pathname.split('/');
          // Si el primer segmento de la ruta es el nombre del bucket
          if (pathParts[0] === this.bucketName) {
            const key = pathParts.slice(1).join('/');
            this.logger.log(`Caso 2: URL con formato s3.region.amazonaws.com/bucket... - key extraída: ${key}`);
            return key;
          }
        }
        
        // Si llegamos aquí, no pudimos determinar la key basándonos en la estructura de la URL
        // Asumimos que la URL ya contiene la key directamente
        this.logger.warn(`No se pudo determinar la key de manera precisa. Devolviendo pathname: ${pathname}`);
        return pathname;
        
      } catch (parseError) {
        this.logger.error(`Error al parsear URL: ${parseError.message}`);
        
        // Intentar extraer la clave usando un enfoque basado en patrones
        if (cleanUrl.includes('/videos/')) {
          const parts = cleanUrl.split('/videos/');
          const key = `videos/${parts[1]}`;
          this.logger.log(`Extracción basada en patrón '/videos/' - key extraída: ${key}`);
          return key;
        }
        
        throw parseError;
      }
    } catch (error) {
      this.logger.error(`Error al procesar la URL: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalname: string,
    mimetype: string
  ): Promise<{ url: string; key: string }> {
    try {
      // Crear un nombre de archivo único para evitar colisiones
      const fileNameSplit = originalname.split('.');
      // Siempre usamos .mp4 como extensión para mejor compatibilidad
      const fileExtension = 'mp4';
      const sanitizedName = this.sanitizeFileName(fileNameSplit[0]);
      const uniqueFileName = `${sanitizedName}-${Date.now()}.${fileExtension}`;
      
      // Clave en S3 (ruta completa)
      const key = `videos/${uniqueFileName}`;
      
      // Siempre establecemos el tipo MIME como video/mp4 para mejor compatibilidad
      const contentType = 'video/mp4';
      
      // Configuración de carga con Content-Type correcto
      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Añadir metadatos para evitar problemas de orientación
        Metadata: {
          'x-amz-meta-orientation': 'normal',
          'x-amz-meta-video-rotation': '0',
          'x-amz-meta-video-transform': 'none',
          'x-amz-meta-video-display': 'inline'
        },
        // Forzar compatibilidad
        ContentDisposition: 'inline',
        // Cache-Control para mejorar el rendimiento
        CacheControl: 'max-age=31536000'
      };
      
      this.logger.log(`Subiendo archivo a S3. Bucket: ${this.bucketName}, Key: ${key}, ContentType: ${contentType}`);
      
      // Subir archivo a S3
      const upload = await this.s3.upload(uploadParams).promise();
      this.logger.log(`Archivo subido exitosamente: ${upload.Location}`);
      
      return {
        url: upload.Location, // Guardamos la URL original de S3 como referencia
        key: key // La clave es lo importante para generar URLs de CloudFront
      };
    } catch (error) {
      this.logger.error(`Error al subir archivo a S3: ${error.message}`, error.stack);
      throw new Error(`Error al subir archivo: ${error.message}`);
    }
  }

  // Método de utilidad para sanitizar nombres de archivo
  private sanitizeFileName(fileName: string): string {
    // Eliminar caracteres no deseados y espacios
    return fileName
      .replace(/[^\w\s.-]/g, '') // Mantener alfanuméricos, espacios, puntos y guiones
      .replace(/\s+/g, '-')      // Reemplazar espacios con guiones
      .toLowerCase();            // Convertir a minúsculas
  }
}