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
      }
    }

    this.privateKeyPath = this.configService.get<string>(
      'aws.cloudFrontPrivateKeyPath',
    );
    this.keyPairId = this.configService.get<string>('aws.cloudFrontKeyPairId');

    // Si no hay dominio de CloudFront configurado, no continuar con la inicialización
    if (!this.distributionDomain) {
      return;
    }

    if (!this.keyPairId) {
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
      const privateKeyBase64 = this.configService.get<string>(
        'aws.cloudFrontPrivateKeyBase64',
      );
      if (privateKeyBase64) {
        try {
          privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
        } catch (e) {
          return;
        }
      }
      // Si no, intentamos leerla desde un archivo
      else if (this.privateKeyPath) {
        try {
          // Verificar si la ruta es relativa o absoluta
          const fullPath = this.privateKeyPath.startsWith('/')
            ? this.privateKeyPath
            : path.join(process.cwd(), this.privateKeyPath);

          // Verificar si el archivo existe
          if (!fs.existsSync(fullPath)) {
            return;
          }

          // Leer el archivo
          privateKey = fs.readFileSync(fullPath, 'utf8');
        } catch (e) {
          return;
        }
      } else {
        return;
      }

      // Inicializar el firmante de CloudFront
      this.signer = new AWS.CloudFront.Signer(this.keyPairId, privateKey);
    } catch (error) {
      return; // No lanzar error, solo continuar sin CloudFront
    }
  }

  /**
   * Genera una URL firmada de CloudFront para el objeto especificado
   * @param objectKey Clave del objeto en S3
   * @param expiresIn Tiempo de expiración en segundos (por defecto 1 hora)
   * @returns URL firmada
   */
  async getSignedUrl(
    objectKey: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      if (!this.signer || !this.distributionDomain) {
        throw new Error('CloudFront no está disponible');
      }

      // Construir URL con el dominio de CloudFront
      const url = `https://${this.distributionDomain}/${objectKey}`;

      // Configurar tiempo de expiración
      const expires = Math.floor(Date.now() / 1000) + expiresIn;

      // Configurar la política de firma - más restrictiva para mayor seguridad
      const policy = {
        Statement: [
          {
            Resource: url,
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': expires,
              },
              // No incluimos condiciones para ContentDisposition o ContentType
              // para permitir la visualización del video sin forzar la descarga
            },
          },
        ],
      };

      // Generar URL firmada sin parámetros que fuercen la descarga
      const signedUrl = this.signer.getSignedUrl({
        url,
        policy: JSON.stringify(policy),
      });

      return signedUrl;
    } catch (error) {
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
        return {};
      }

      const expireTime = Math.floor(Date.now() / 1000) + expiresIn;

      // Crear política para todas las URLs de este dominio
      const policy = {
        Statement: [
          {
            Resource: `https://${this.distributionDomain}/*`,
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': expireTime,
              },
            },
          },
        ],
      };

      // Generar cookies firmadas
      const signedCookies = this.signer.getSignedCookie({
        policy: JSON.stringify(policy),
      });

      // Convertir el resultado a Record<string, string>
      const cookies: Record<string, string> = {};
      Object.keys(signedCookies).forEach((key) => {
        cookies[key] = signedCookies[key] as string;
      });

      return cookies;
    } catch (error) {
      this.logger.error(
        `Error al generar cookies firmadas: ${error.message}`,
        error.stack,
      );
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
