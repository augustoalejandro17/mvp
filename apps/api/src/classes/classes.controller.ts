import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
  Patch,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { Request, Response } from 'express';
import { PermissionsGuard, Permission } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import * as https from 'https';
import * as http from 'http';

const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/mpeg', // .mpeg, .mpg
  'video/x-matroska', // .mkv
  'video/3gpp', // .3gp
  'video/ogg', // .ogv
  'video/x-m4v', // .m4v
];

const ALLOWED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mpeg',
  '.mpg',
  '.mkv',
  '.3gp',
  '.ogv',
  '.m4v',
];

const isAllowedVideoFile = (file: Express.Multer.File): boolean => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  const fileName = String(file.originalname || '').toLowerCase();

  const hasAllowedMime = ALLOWED_VIDEO_MIME_TYPES.includes(mimeType);
  const hasAllowedExtension = ALLOWED_VIDEO_EXTENSIONS.some((ext) =>
    fileName.endsWith(ext),
  );

  return hasAllowedMime || hasAllowedExtension;
};

const videoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: any, acceptFile: boolean) => void,
) => {
  if (isAllowedVideoFile(file)) {
    callback(null, true);
    return;
  }

  callback(
    new BadRequestException(
      `Formato de archivo no soportado: ${file.mimetype}. Se admiten solamente archivos de video.`,
    ),
    false,
  );
};

@Controller('classes')
export class ClassesController {
  private readonly logger = new Logger(ClassesController.name);

  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(@Req() req, @Query('courseId') courseId?: string) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    return this.classesService.findAll(userId, user?.role, courseId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const userRole = user?.role;
    return this.classesService.findOne(id, userId, userRole);
  }

  @Get(':id/stream-url')
  @UseGuards(OptionalJwtAuthGuard)
  async getStreamingUrl(
    @Param('id') id: string,
    @Req() req,
    @Query('direct') direct?: string,
  ) {
    try {
      const user = req.user as any;
      const userId = user?._id || user?.sub;
      const userRole = user?.role;

      // First check if user has access to this class
      const classItem = await this.classesService.findOne(id, userId, userRole);

      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }

      // Check video processing status
      if (!classItem.videoUrl) {
        const status = classItem.videoStatus || 'NONE';
        return {
          success: false,
          status: status,
          message:
            status === 'UPLOADING'
              ? 'Video siendo subido'
              : status === 'PROCESSING'
                ? 'Video siendo procesado'
                : 'Video no disponible',
          title: classItem.title,
        };
      }

      // Mobile clients can request a direct signed URL for better native seeking support.
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

      // Return proxy URL by default (web clients / same-origin flows).
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;

      return {
        success: true,
        url: `${baseUrl}/api/classes/${id}/video-proxy`,
        title: classItem.title,
        metadata: classItem.videoMetadata || {},
        isCloudFront: false, // This is now proxied through our backend
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

  @Get(':id/video-proxy')
  @UseGuards(OptionalJwtAuthGuard)
  async streamVideo(@Param('id') id: string, @Req() req, @Res() res: Response) {
    try {
      const user = req.user as any;
      const userId = user?._id || user?.sub;
      const userRole = user?.role;

      // Check if user has access to this class
      const classItem = await this.classesService.findOne(id, userId, userRole);

      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }

      if (!classItem.videoUrl) {
        throw new NotFoundException(`Video no disponible para esta clase`);
      }

      // Get the actual S3 signed URL (this handles authentication internally)
      const signedUrl = await this.classesService.getSignedUrlForStreaming(
        classItem.videoUrl,
      );

      const parsedUrl = new URL(signedUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {},
      };

      // Add range header if present for video seeking
      if (req.headers.range) {
        requestOptions.headers['Range'] = req.headers.range;
      }

      // Add user agent if present
      if (req.headers['user-agent']) {
        requestOptions.headers['User-Agent'] = req.headers['user-agent'];
      }

      const proxyReq = client.request(requestOptions, (proxyRes) => {
        // Set appropriate response headers
        res.set(
          'Content-Type',
          proxyRes.headers['content-type'] || 'video/mp4',
        );
        res.set('Accept-Ranges', 'bytes');

        if (proxyRes.headers['content-length']) {
          res.set('Content-Length', proxyRes.headers['content-length']);
        }

        if (proxyRes.headers['content-range']) {
          res.set('Content-Range', proxyRes.headers['content-range']);
          res.status(206); // Partial content
        }

        // Set the status code from the proxy response
        res.status(proxyRes.statusCode || 200);

        // Pipe the stream to the response
        proxyRes.pipe(res);
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
      });

      proxyReq.end();
    } catch (error) {
      this.logger.error(`Error streaming video: ${error.message}`, error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al transmitir video: ${error.message}`,
      );
    }
  }

  @Get(':id/download-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getDownloadUrl(@Param('id') id: string, @Req() req) {
    try {
      // Find the class
      const classItem = await this.classesService.findOne(id);

      if (!classItem) {
        throw new NotFoundException(`Class with ID ${id} not found`);
      }

      // Check if video is available for download
      if (!classItem.videoUrl) {
        const status = classItem.videoStatus || 'NONE';
        throw new BadRequestException(
          status === 'UPLOADING'
            ? 'Video siendo subido'
            : status === 'PROCESSING'
              ? 'Video siendo procesado'
              : 'Video no disponible para descarga',
        );
      }

      // Generate a URL specifically for download
      // We'll reuse the streaming URL method but will later modify it to support downloads
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
      if (error instanceof NotFoundException) {
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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB para soportar videos más grandes
      },
      fileFilter: videoFileFilter,
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createClassDto: CreateClassDto,
    @Req() req,
  ) {
    const userId = req.user.sub || req.user._id?.toString();

    try {
      // Use worker-based processing for better scalability
      return await this.classesService.createWithWorkerProcessing(
        createClassDto,
        userId,
        file,
      );
    } catch (error) {
      this.logger.error(
        `Error al crear la clase: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB para soportar videos más grandes
      },
      fileFilter: videoFileFilter,
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateClassDto: UpdateClassDto,
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user = req.user as any;
    const userId = user._id || user.sub;

    try {
      // Si hay un nuevo video, actualizar con el archivo
      if (file) {
        return await this.classesService.updateWithVideo(
          id,
          updateClassDto,
          userId,
          file,
        );
      } else {
        // Si no hay nuevo video, actualizar solo los datos
        const result = await this.classesService.update(
          id,
          updateClassDto,
          userId,
        );

        return result;
      }
    } catch (error) {
      this.logger.error(
        `Error al actualizar clase: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user._id || user.sub;

    try {
      const result = await this.classesService.remove(id, userId);

      return {
        ...result,
        status: 'success',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error al eliminar clase: ${error.message}`,
        error.stack,
      );

      // Si es un error de permisos de AWS, dar un mensaje más amigable
      if (
        error.message?.includes('not authorized to perform: s3:DeleteObject') ||
        error.message?.includes('identity-based policy') ||
        error.code === 'AccessDenied'
      ) {
        throw new InternalServerErrorException({
          message:
            'La clase se eliminó de la base de datos, pero el video podría permanecer en el servidor debido a permisos insuficientes. Esto no afecta el funcionamiento del sistema.',
          status: 'partial_success',
          details:
            'Contacta al administrador si necesitas eliminar también el archivo de video.',
        });
      }

      throw error;
    }
  }

  @Post(':id/attendance')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async recordAttendance(
    @Param('id') classId: string,
    @Body() recordAttendanceDto: RecordAttendanceDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.classesService.recordAttendance(
      classId,
      recordAttendanceDto,
      userId,
    );
  }

  @Get(':id/attendance')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getAttendance(
    @Param('id') classId: string,
    @Query('date') date?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.classesService.getAttendance(classId, date, start, end);
  }

  @Get(':id/attendance/student/:studentId')
  @UseGuards(JwtAuthGuard)
  async getStudentAttendance(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    // Students can only view their own attendance
    if (req.user.role === UserRole.STUDENT && req.user.sub !== studentId) {
      throw new UnauthorizedException(
        'You can only view your own attendance records',
      );
    }

    return this.classesService.getStudentAttendance(classId, studentId);
  }

  @Patch(':id/attendance/:attendanceId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.UPDATE_ATTENDANCE)
  async updateAttendance(
    @Param('id') classId: string,
    @Param('attendanceId') attendanceId: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.classesService.updateAttendance(
      classId,
      attendanceId,
      updateAttendanceDto,
      userId,
    );
  }

  @Delete(':id/attendance/:attendanceId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELETE_ATTENDANCE)
  async deleteAttendance(
    @Param('id') classId: string,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.classesService.deleteAttendance(classId, attendanceId);
  }
}
