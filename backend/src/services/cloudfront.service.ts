import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CloudFrontService {
  private readonly logger = new Logger(CloudFrontService.name);
  private cloudFront: AWS.CloudFront;
  private signer: AWS.CloudFront.Signer;
  private distributionDomain: string;
  private privateKeyPath: string;
  private keyPairId: string;

  constructor(private configService: ConfigService) {
    const awsRegion = this.configService.get<string>('aws.region');
    
    // Limpiar el dominio de CloudFront si viene con https:// o http://
    const rawDomain = this.configService.get<string>('aws.cloudFrontDomain');
    if (rawDomain) {
      this.distributionDomain = rawDomain.replace(/^https?:\/\//, '');
      // Si el dominio original incluía protocolo, registrar que se quitó
      if (rawDomain !== this.distributionDomain) {
        this.logger.log(`CloudFront domain ajustado: ${rawDomain} -> ${this.distributionDomain}`);
      }
    }
    
    this.privateKeyPath = this.configService.get<string>('aws.cloudFrontPrivateKeyPath');
    this.keyPairId = this.configService.get<string>('aws.cloudFrontKeyPairId');

    // Si no hay dominio de CloudFront configurado, no continuar con la inicialización
    if (!this.distributionDomain) {
      this.logger.warn('No se ha configurado el dominio de CloudFront (AWS_CLOUDFRONT_DOMAIN). CloudFront no estará disponible.');
      return;
    }

    if (!this.keyPairId) {
      this.logger.warn('No se ha configurado el Key Pair ID de CloudFront (AWS_CLOUDFRONT_KEY_PAIR_ID). CloudFront no estará disponible.');
      return;
    }

    // Configurar AWS SDK
    AWS.config.update({
      region: awsRegion,
      accessKeyId: this.configService.get<string>('aws.accessKeyId'),
      secretAccessKey: this.configService.get<string>('aws.secretAccessKey'),
    });

    this.cloudFront = new AWS.CloudFront();

    try {
      // Leer la clave privada
      let privateKey: string;
      
      // Si tenemos la clave privada codificada en base64 en variables de entorno
      const privateKeyBase64 = this.configService.get<string>('aws.cloudFrontPrivateKeyBase64');
      if (privateKeyBase64) {
        try {
          privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
          this.logger.log('Usando clave privada de CloudFront desde variables de entorno');
        } catch (e) {
          this.logger.warn(`Error decodificando la clave privada de base64: ${e.message}. CloudFront no estará disponible.`);
          return;
        }
      } 
      // Si no, intentamos leerla desde un archivo
      else if (this.privateKeyPath) {
        try {
          this.logger.log(`Intentando cargar clave privada desde: ${this.privateKeyPath}`);
          
          // Verificar si la ruta es relativa o absoluta
          const fullPath = this.privateKeyPath.startsWith('/') 
            ? this.privateKeyPath 
            : path.join(process.cwd(), this.privateKeyPath);
          
          this.logger.log(`Ruta completa de la clave: ${fullPath}`);
          
          // Verificar si el archivo existe
          if (!fs.existsSync(fullPath)) {
            this.logger.warn(`El archivo de clave privada no existe en: ${fullPath}. CloudFront no estará disponible.`);
            return;
          }
          
          // Leer el archivo
          privateKey = fs.readFileSync(fullPath, 'utf8');
          this.logger.log(`Clave privada de CloudFront cargada exitosamente (longitud: ${privateKey.length} caracteres)`);
        } catch (e) {
          this.logger.warn(`Error leyendo archivo de clave privada: ${e.message}. CloudFront no estará disponible.`);
          return;
        }
      } else {
        this.logger.warn('No se encontró clave privada para CloudFront. No se pueden generar URLs firmadas.');
        return;
      }

      // Inicializar el firmante de CloudFront
      this.signer = new AWS.CloudFront.Signer(this.keyPairId, privateKey);
      this.logger.log('CloudFront signer inicializado correctamente');
    } catch (error) {
      this.logger.warn(`Error al inicializar CloudFront signer: ${error.message}. CloudFront no estará disponible.`);
      return; // No lanzar error, solo continuar sin CloudFront
    }
  }

  /**
   * Genera una URL firmada de CloudFront para el objeto especificado
   * @param objectKey Clave del objeto en S3
   * @param expiresIn Tiempo de expiración en segundos (por defecto 1 hora)
   * @returns URL firmada
   */
  async getSignedUrl(objectKey: string, expiresIn: number = 3600): Promise<string> {
    try {
      if (!this.signer || !this.distributionDomain) {
        this.logger.warn('CloudFront no está configurado correctamente. Usando URL sin firmar.');
        throw new Error('CloudFront no está disponible');
      }

      // Construir URL con el dominio de CloudFront
      const url = `https://${this.distributionDomain}/${objectKey}`;
      
      // Configurar tiempo de expiración
      const expires = Math.floor(Date.now() / 1000) + expiresIn;
      
      // Configurar la política de firma - más restrictiva para mayor seguridad
      const policy = {
        Statement: [{
          Resource: url,
          Condition: {
            DateLessThan: {
              'AWS:EpochTime': expires
            },
            // No incluimos condiciones para ContentDisposition o ContentType
            // para permitir la visualización del video sin forzar la descarga
          }
        }]
      };

      // Generar URL firmada sin parámetros que fuercen la descarga
      const signedUrl = this.signer.getSignedUrl({
        url,
        policy: JSON.stringify(policy)
      });

      this.logger.log(`URL firmada de CloudFront generada para: ${objectKey} (expira en ${expiresIn} segundos)`);
      return signedUrl;
    } catch (error) {
      this.logger.warn(`Error al generar URL firmada de CloudFront: ${error.message}. Usando fallback.`);
      throw error;
    }
  }

  /**
   * Genera una cookie firmada para CloudFront
   * @param expiresIn Tiempo de expiración en segundos
   * @returns Objeto con las cookies firmadas
   */
  getCookies(expiresIn: number = 3600): Record<string, string> {
    try {
      if (!this.signer) {
        this.logger.warn('CloudFront no está configurado correctamente. No se pueden generar cookies.');
        return {};
      }

      const expireTime = Math.floor(Date.now() / 1000) + expiresIn;
      
      // Crear política para todas las URLs de este dominio
      const policy = {
        Statement: [{
          Resource: `https://${this.distributionDomain}/*`,
          Condition: {
            DateLessThan: {
              'AWS:EpochTime': expireTime
            }
          }
        }]
      };

      // Generar cookies firmadas
      const signedCookies = this.signer.getSignedCookie({
        policy: JSON.stringify(policy)
      });

      // Convertir el resultado a Record<string, string>
      const cookies: Record<string, string> = {};
      Object.keys(signedCookies).forEach(key => {
        cookies[key] = signedCookies[key] as string;
      });

      this.logger.log('Cookies firmadas de CloudFront generadas');
      return cookies;
    } catch (error) {
      this.logger.error(`Error al generar cookies firmadas: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Construye una URL de CloudFront para un objeto
   * @param key Clave del objeto en S3
   * @returns URL completa de CloudFront
   */
  getObjectUrl(key: string): string {
    return `https://${this.distributionDomain}/${key}`;
  }
} 