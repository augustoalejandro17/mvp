import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { CloudFrontService } from '../services/cloudfront.service';
import { StorageIntegrationService } from '../usage/integration/storage-integration.service';

@Injectable()
export class S3Service {
  private readonly s3: S3;
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName: string;

  constructor(
    private configService: ConfigService,
    private cloudFrontService: CloudFrontService,
    @Inject(forwardRef(() => StorageIntegrationService))
    private storageIntegrationService?: StorageIntegrationService
  ) {
    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('aws.accessKeyId'),
      secretAccessKey: this.configService.get<string>('aws.secretAccessKey'),
      region: this.configService.get<string>('aws.region'),
    });
    this.bucketName = this.configService.get<string>('aws.s3.bucketName');
    
  }

  async uploadVideo(file: Express.Multer.File): Promise<string> {
    try {
      
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

      
      
      const uploadResult = await this.s3.upload(uploadParams).promise();

      // Track storage usage for billing
      if (this.storageIntegrationService) {
        try {
          // Note: We need additional parameters for proper tracking
          // This would need to be called from a higher level with proper context
          this.logger.log(`Video uploaded: ${key}, size: ${file.size} bytes - tracking should be called from controller level`);
        } catch (trackingError) {
          this.logger.warn(`Failed to track storage usage: ${trackingError.message}`);
        }
      }
      
      // Priorizar el uso de CloudFront como fuente de la URL
      if (this.cloudFrontService) {
        try {
          // Generar URL firmada de CloudFront con expiración de 24 horas
          const cloudFrontUrl = await this.cloudFrontService.getSignedUrl(key, 86400);
          
          return cloudFrontUrl;
        } catch (cloudFrontError) {
          
        }
      } else {
        
      }
      
      // Fallback: Generar URL firmada para S3 directamente si CloudFront falla
      try {
        const signedUrlParams = {
          Bucket: this.bucketName,
          Key: key,
          Expires: 7 * 24 * 60 * 60, // 1 semana en segundos
          ResponseContentType: 'video/mp4'
        };
        
        const signedUrl = await this.s3.getSignedUrlPromise('getObject', signedUrlParams);
        
        return signedUrl;
      } catch (signError) {
        this.logger.error(`Error generando URL firmada de S3: ${signError.message}`, signError.stack);
        // Último recurso: devolver la URL sin firmar (probablemente no funcionará por Block Public Access)
        return uploadResult.Location;
      }
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
  async getSignedUrl(key: string, expiresIn: number = 3600, contentType?: string): Promise<string> {
    // Asegurarnos de que tenemos una key válida
    if (!key) {
      this.logger.error('getSignedUrl: Se intentó generar una URL para una key vacía');
      throw new Error('La clave del objeto S3 no puede estar vacía');
    }

    // Limpiar la key si viene con la URL completa
    let cleanKey = key;
    if (key.includes('amazonaws.com')) {
      cleanKey = this.getKeyFromUrl(key);
      
    }

    // Determinar el tipo de contenido basado en la extensión del archivo si no se proporciona
    if (!contentType) {
      if (cleanKey.endsWith('.mp4') || cleanKey.endsWith('.webm')) {
        contentType = 'video/mp4';
      } else if (cleanKey.endsWith('.jpg') || cleanKey.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (cleanKey.endsWith('.png')) {
        contentType = 'image/png';
      } else if (cleanKey.endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (cleanKey.includes('/images/')) {
        contentType = 'image/jpeg'; // Valor por defecto para imágenes
      } else {
        contentType = 'application/octet-stream'; // Valor por defecto genérico
      }
    }

    const params = {
      Bucket: this.bucketName,
      Key: cleanKey,
      Expires: expiresIn,
      ResponseContentType: contentType,
      ResponseCacheControl: 'max-age=3600'
      // No incluimos ResponseContentDisposition para permitir la visualización en el navegador
    };

    try {
      
      const url = await this.s3.getSignedUrlPromise('getObject', params);
      
      return url;
    } catch (error) {
      this.logger.error(`Error al generar URL firmada: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteVideo(videoUrl: string): Promise<void> {
    try {
      if (!videoUrl) {
        this.logger.warn('Se intentó eliminar un video con URL vacía');
        return;
      }

      const key = this.getKeyFromUrl(videoUrl);
      try {
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: key,
        }).promise();
        
        this.logger.log(`Video eliminado correctamente: ${key}`);
      } catch (s3Error) {
        // Capturar errores específicos de permisos en S3
        if (s3Error.code === 'AccessDenied' || s3Error.name === 'AccessDenied') {
          this.logger.warn(`Acceso denegado al intentar eliminar el video ${key}. El archivo permanecerá en S3.`);
          // No lanzamos error en este caso, simplemente registramos y continuamos
          return;
        }
        
        // Para otros tipos de errores, registramos pero no interrumpimos el flujo
        this.logger.error(`Error al eliminar video de S3 (${key}): ${s3Error.message}`, s3Error.stack);
        // No lanzamos el error para permitir que el proceso de eliminación de la clase continúe
      }
    } catch (error) {
      // Errores en la lógica de la función (ej. al obtener la clave)
      this.logger.error(`Error al procesar la eliminación del video: ${error.message}`, error.stack);
      // No lanzamos el error para permitir que el proceso de eliminación de la clase continúe
    }
  }

  public getKeyFromUrl(url: string): string {
    try {
      
      
      // Si la URL contiene parámetros de consulta, los eliminamos
      let cleanUrl = url;
      if (url.includes('?')) {
        cleanUrl = url.split('?')[0];
        
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
        
        
        
        // Caso 1: URL en formato bucket-name.s3.region.amazonaws.com
        if (hostname.includes(this.bucketName)) {
          
          return pathname;
        }
        
        // Caso 2: URL en formato s3.region.amazonaws.com/bucket-name
        if (hostname.includes('s3.amazonaws.com')) {
          const pathParts = pathname.split('/');
          // Si el primer segmento de la ruta es el nombre del bucket
          if (pathParts[0] === this.bucketName) {
            const key = pathParts.slice(1).join('/');
            
            return key;
          }
        }
        
        // Si llegamos aquí, no pudimos determinar la key basándonos en la estructura de la URL
        // Asumimos que la URL ya contiene la key directamente
        
        return pathname;
        
      } catch (parseError) {
        this.logger.error(`Error al parsear URL: ${parseError.message}`);
        
        // Intentar extraer la clave usando un enfoque basado en patrones
        if (cleanUrl.includes('/videos/')) {
          const parts = cleanUrl.split('/videos/');
          const key = `videos/${parts[1]}`;
          
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
      
      
      
      // Subir archivo a S3
      const upload = await this.s3.upload(uploadParams).promise();
      
      
      // Variable para almacenar la URL final
      let url = upload.Location;
      
      // Priorizar el uso de CloudFront como fuente de la URL
      if (this.cloudFrontService) {
        try {
          // Generar URL firmada de CloudFront con expiración de 24 horas
          url = await this.cloudFrontService.getSignedUrl(key, 86400);
          
        } catch (cloudFrontError) {
          
          
          // Fallback: Generar URL firmada para S3 directamente si CloudFront falla
          try {
            const signedUrlParams = {
              Bucket: this.bucketName,
              Key: key,
              Expires: 7 * 24 * 60 * 60, // 1 semana en segundos
              ResponseContentType: contentType
            };
            
            url = await this.s3.getSignedUrlPromise('getObject', signedUrlParams);
            
          } catch (signError) {
            this.logger.error(`Error generando URL firmada de S3: ${signError.message}`, signError.stack);
            // Mantener la URL original como último recurso
            
          }
        }
      } else {
        
        
        // Intentar generar URL firmada de S3 si CloudFront no está disponible
        try {
          const signedUrlParams = {
            Bucket: this.bucketName,
            Key: key,
            Expires: 7 * 24 * 60 * 60, // 1 semana en segundos
            ResponseContentType: contentType
          };
          
          url = await this.s3.getSignedUrlPromise('getObject', signedUrlParams);
          
        } catch (signError) {
          this.logger.error(`Error generando URL firmada de S3: ${signError.message}`, signError.stack);
          // Mantener la URL original como último recurso
          
        }
      }
      
      return {
        url, // URL de CloudFront o S3 firmada, o URL sin firmar como fallback
        key  // La clave para referencias futuras
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

  /**
   * Sube una imagen a S3 y devuelve la URL pública
   * @param file Archivo de imagen a subir
   * @returns URL pública de la imagen
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    try {
      
      
      // Obtener extensión del archivo original
      const fileExtension = file.originalname.split('.').pop() || 'jpg';
      
      // Sanitizar el nombre del archivo
      const sanitizedName = this.sanitizeFileName(file.originalname.split('.')[0]);
      
      // Crear un nombre único para la imagen con timestamp para evitar cacheo
      const timestamp = Date.now();
      const key = `images/${sanitizedName}-${timestamp}-${uuidv4()}.${fileExtension}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Configurar cache para tiempo limitado (1 hora) para facilitar actualizaciones
        CacheControl: 'max-age=3600',
        // Configurar disposición para visualización en navegador
        ContentDisposition: 'inline',
        // Agregar metadatos para mejor gestión
        Metadata: {
          'original-name': this.sanitizeFileName(file.originalname),
          'upload-timestamp': timestamp.toString()
        }
      };

      
      
      // Subir la imagen a S3
      const uploadResult = await this.s3.upload(uploadParams).promise();
      
      
      // Priorizar el uso de CloudFront para todas las imágenes (similar a como funciona para videos)
      if (this.cloudFrontService) {
        try {
          // Generar URL firmada de CloudFront con 24 horas de expiración
          const cloudFrontUrl = await this.cloudFrontService.getSignedUrl(key, 86400);
          
          
          // Añadir parámetro anti-cache
          const imageUrl = cloudFrontUrl.includes('?') 
            ? `${cloudFrontUrl}&t=${timestamp}` 
            : `${cloudFrontUrl}?t=${timestamp}`;
          
          
          return imageUrl;
        } catch (cloudFrontError) {
          
        }
      } else {
        
      }
      
      // Fallback: Generar URL firmada para S3 directamente si CloudFront falla
      try {
        const signedUrlParams = {
          Bucket: this.bucketName,
          Key: key,
          Expires: 7 * 24 * 60 * 60, // 1 semana en segundos
          ResponseContentType: file.mimetype
        };
        
        const signedUrl = await this.s3.getSignedUrlPromise('getObject', signedUrlParams);
        
        
        // Añadir parámetro anti-cache
        const imageUrl = signedUrl.includes('?') 
          ? `${signedUrl}&t=${timestamp}` 
          : `${signedUrl}?t=${timestamp}`;
        
        return imageUrl;
      } catch (signError) {
        this.logger.error(`Error generando URL firmada de S3: ${signError.message}`, signError.stack);
        // Último recurso: devolver la URL sin firmar (probablemente no funcionará por Block Public Access)
        return `${uploadResult.Location}?t=${timestamp}`;
      }
    } catch (error) {
      this.logger.error('Error subiendo imagen a S3:', error);
      throw new Error(`Error al subir imagen: ${error.message}`);
    }
  }
}