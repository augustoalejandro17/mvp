import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as https from 'https';
import * as http from 'http';
import { UserRole } from '../auth/schemas/user.schema';
import { ClassesService } from './classes.service';

@Injectable()
export class ClassVideoService {
  private readonly logger = new Logger(ClassVideoService.name);

  constructor(private readonly classesService: ClassesService) {}

  async getStreamingUrlPayload(
    classId: string,
    req: Request,
    direct?: string,
  ) {
    try {
      const user = req.user as any;
      const userId = user?._id || user?.sub;
      const userRole = user?.role as UserRole | undefined;

      const classItem = await this.classesService.findOne(
        classId,
        userId,
        userRole,
      );

      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${classId} no encontrada`);
      }

      if (!classItem.videoUrl) {
        const status = classItem.videoStatus || 'NONE';
        return {
          success: false,
          status,
          message:
            status === 'NO_VIDEO'
              ? 'Todavía no se ha subido un video para esta clase'
              : status === 'UPLOADING'
              ? 'Video siendo subido'
              : status === 'PROCESSING'
                ? 'Video siendo procesado'
                : 'Video no disponible',
          title: classItem.title,
        };
      }

      const useDirect = String(direct).toLowerCase() === 'true';
      if (useDirect) {
        const signedUrl = await this.classesService.getSignedUrlForStreaming(
          classItem.videoUrl,
        );

        return {
          success: true,
          url: signedUrl,
          title: classItem.title,
          metadata: classItem.videoMetadata || {},
          isCloudFront: signedUrl.includes('cloudfront.net'),
        };
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      return {
        success: true,
        url: `${baseUrl}/api/classes/${classId}/video-proxy`,
        title: classItem.title,
        metadata: classItem.videoMetadata || {},
        isCloudFront: false,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener URL de streaming: ${error.message}`,
      );
    }
  }

  async streamVideoProxy(
    classId: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const user = req.user as any;
      const userId = user?._id || user?.sub;
      const userRole = user?.role as UserRole | undefined;

      const classItem = await this.classesService.findOne(
        classId,
        userId,
        userRole,
      );

      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${classId} no encontrada`);
      }

      if (!classItem.videoUrl) {
        throw new NotFoundException(`Video no disponible para esta clase`);
      }

      const signedUrl = await this.classesService.getSignedUrlForStreaming(
        classItem.videoUrl,
      );

      const parsedUrl = new URL(signedUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions: {
        hostname: string;
        port: string | number;
        path: string;
        method: string;
        headers: Record<string, string>;
      } = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {},
      };

      if (req.headers.range) {
        requestOptions.headers.Range = req.headers.range;
      }

      if (req.headers['user-agent']) {
        requestOptions.headers['User-Agent'] = String(
          req.headers['user-agent'],
        );
      }

      await new Promise<void>((resolve, reject) => {
        const proxyReq = client.request(requestOptions, (proxyRes) => {
          res.set(
            'Content-Type',
            String(proxyRes.headers['content-type'] || 'video/mp4'),
          );
          res.set('Accept-Ranges', 'bytes');

          if (proxyRes.headers['content-length']) {
            res.set(
              'Content-Length',
              String(proxyRes.headers['content-length']),
            );
          }

          if (proxyRes.headers['content-range']) {
            res.set('Content-Range', String(proxyRes.headers['content-range']));
            res.status(206);
          }

          res.status(proxyRes.statusCode || 200);
          proxyRes.pipe(res);
          proxyRes.on('end', () => resolve());
          proxyRes.on('error', reject);
        });

        proxyReq.on('error', (error) => {
          this.logger.error(`Failed to fetch video: ${error.message}`);
          if (!res.headersSent) {
            res
              .status(502)
              .json({ message: `Failed to fetch video: ${error.message}` });
          } else {
            res.end();
          }
          reject(error);
        });

        proxyReq.end();
      });
    } catch (error) {
      this.logger.error(`Error streaming video: ${error.message}`, error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Error al transmitir video: ${error.message}`,
      );
    }
  }

  async getDownloadUrlPayload(classId: string) {
    try {
      const classItem = await this.classesService.findOne(classId);

      if (!classItem) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      if (!classItem.videoUrl) {
        const status = classItem.videoStatus || 'NONE';
        throw new BadRequestException(
          status === 'NO_VIDEO'
            ? 'Todavía no se ha subido un video para esta clase'
            : status === 'UPLOADING'
            ? 'Video siendo subido'
            : status === 'PROCESSING'
              ? 'Video siendo procesado'
              : 'Video no disponible para descarga',
        );
      }

      const downloadUrl = await this.classesService.getSignedUrlForStreaming(
        classItem.videoUrl,
      );

      return {
        success: true,
        url: downloadUrl,
        title: classItem.title,
        filename: `${classItem.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`,
        contentType: 'video/mp4',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Error generating download URL: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error generating download URL: ${error.message}`,
      );
    }
  }
}
