import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Logger, Query, UseInterceptors, UploadedFile, BadRequestException, NotFoundException, InternalServerErrorException, UnauthorizedException, Patch, Res } from '@nestjs/common';
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

@Controller('classes')
export class ClassesController {
  private readonly logger = new Logger(ClassesController.name);

  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req, @Query('courseId') courseId?: string) {
    this.logger.log(`Procesando solicitud para obtener todas las clases${courseId ? ` del curso ${courseId}` : ''}`);
    const user = req.user as any;
    const userId = user._id || user.sub;
    return this.classesService.findAll(userId, user.role, courseId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    this.logger.log(`Procesando solicitud para obtener clase con ID: ${id}`);
    return this.classesService.findOne(id);
  }

  @Get(':id/stream-url')
  @UseGuards(JwtAuthGuard)
  async getStreamingUrl(@Param('id') id: string) {
    try {
      // Buscar la clase
      const classItem = await this.classesService.findOne(id);
      
      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }
      
      // Generar una URL específica para streaming (no descarga)
      const streamUrl = await this.classesService.getSignedUrlForStreaming(classItem.videoUrl);
      
      return {
        success: true,
        url: streamUrl,
        title: classItem.title,
        metadata: classItem.videoMetadata || {},
        isCloudFront: streamUrl?.includes('cloudfront.net') || false
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al obtener URL de streaming: ${error.message}`);
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
      
      // Generate a URL specifically for download
      // We'll reuse the streaming URL method but will later modify it to support downloads
      const downloadUrl = await this.classesService.getSignedUrlForStreaming(classItem.videoUrl);
      
      this.logger.log(`Download URL generated for class ${id} by user ${req.user.sub}`);
      
      return {
        success: true,
        url: downloadUrl,
        title: classItem.title,
        filename: `${classItem.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`,
        contentType: 'video/mp4'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error generating download URL: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error generating download URL: ${error.message}`);
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('video', {
    limits: {
      fileSize: 200 * 1024 * 1024, // 200MB para soportar videos más grandes
    },
    fileFilter: (req, file, callback) => {
      // Durante pruebas, aceptar cualquier archivo
      if (process.env.NODE_ENV === 'development') {
        // Forzar el mimetype a video/mp4 para todos los tipos
        file.mimetype = 'video/mp4';
        
        // Cambiar la extensión a .mp4 en el nombre del archivo
        const nameParts = file.originalname.split('.');
        if (nameParts.length > 1) {
          nameParts.pop(); // Eliminar la extensión existente
        }
        file.originalname = `${nameParts.join('.')}.mp4`;
        
        callback(null, true);
        return;
      }
      
      // En producción, continuar con la validación normal
      const allowedMimeTypes = [
        'video/mp4',
        'video/webm',
        'video/quicktime', // .mov
        'video/x-msvideo', // .avi
        'video/mpeg',      // .mpeg, .mpg
        'video/x-matroska', // .mkv
        'video/3gpp',      // .3gp
        'video/ogg'        // .ogv
      ];
      
      // Renombrar el mimetype para que todos sean tratados como mp4
      if (allowedMimeTypes.includes(file.mimetype)) {
        // Forzar el mimetype a video/mp4 para todos los tipos de video
        file.mimetype = 'video/mp4';
        
        // Cambiar la extensión a .mp4 en el nombre del archivo
        const nameParts = file.originalname.split('.');
        if (nameParts.length > 1) {
          nameParts.pop(); // Eliminar la extensión existente
        }
        file.originalname = `${nameParts.join('.')}.mp4`;
        
        callback(null, true);
        return;
      }
      
      callback(
        new BadRequestException(
          `Formato de archivo no soportado: ${file.mimetype}. Se admiten solamente archivos de video.`
        ), 
        false
      );
    }
  }))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createClassDto: CreateClassDto,
    @Req() req
  ) {
    const userId = req.user.sub || req.user._id?.toString();
    
    if (!file) {
      throw new BadRequestException('No se ha proporcionado ningún archivo de video');
    }
    
    this.logger.log(`Archivo recibido: ${file.originalname}, tamaño: ${file.size}, tipo: ${file.mimetype}`);
    
    try {
      return await this.classesService.create(createClassDto, userId, file);
    } catch (error) {
      this.logger.error(`Error al crear la clase: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateClassDto: UpdateClassDto, @Req() req: Request) {
    this.logger.log(`Procesando solicitud para actualizar clase con ID: ${id}`);
    const user = req.user as any;
    const userId = user._id || user.sub;
    
    try {
      const result = await this.classesService.update(id, updateClassDto, userId);
      this.logger.log(`Clase actualizada con éxito: ${result._id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al actualizar clase: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    this.logger.log(`Procesando solicitud para eliminar clase con ID: ${id}`);
    const user = req.user as any;
    const userId = user._id || user.sub;
    
    try {
      const result = await this.classesService.remove(id, userId);
      this.logger.log(`Clase eliminada con éxito`);
      return result;
    } catch (error) {
      this.logger.error(`Error al eliminar clase: ${error.message}`, error.stack);
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
    return this.classesService.recordAttendance(classId, recordAttendanceDto, userId);
  }

  @Get(':id/attendance')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getAttendance(
    @Param('id') classId: string,
    @Query('date') date?: string,
  ) {
    return this.classesService.getAttendance(classId, date);
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
      throw new UnauthorizedException('You can only view your own attendance records');
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
    return this.classesService.updateAttendance(classId, attendanceId, updateAttendanceDto, userId);
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