import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Class, ClassDocument } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CoursesService } from '../courses/courses.service';
import { S3Service } from '../services/s3.service';
import { User, UserDocument, UserRole } from '../auth/schemas/user.schema';
import { AuthService } from '../auth/auth.service';
import { AuthorizationService } from '../auth/services/authorization.service';
import { CloudFrontService } from '../services/cloudfront.service';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import {
  Attendance,
  AttendanceDocument,
} from '../attendance/schemas/attendance.schema';
import { VideoProcessorService } from '../services/video-processor.service';
import { StorageIntegrationService } from '../usage/integration/storage-integration.service';
import * as fs from 'fs';
import {
  Enrollment,
  EnrollmentDocument,
} from '../courses/schemas/enrollment.schema';
import { UsageHooksService } from '../usage/hooks/usage-hooks.service';
import { VideoStatus } from './schemas/class.schema';
import { getUserIdFromRequest } from '../utils/token-handler';
import { NotificationsService } from '../notifications/notifications.service';

// Función de utilidad para comparar roles
const compareRole = (userRole: any, enumRole: UserRole): boolean => {
  // Si los roles son directamente iguales (mismo enum)
  if (userRole === enumRole) return true;

  // Si no, comparamos los valores como strings para evitar problemas de tipos distintos
  const userRoleStr = String(userRole).toLowerCase();
  const enumRoleStr = String(enumRole).toLowerCase();

  return userRoleStr === enumRoleStr;
};

interface ClassWithVideo extends ClassDocument {
  videoFileName?: string;
  videoFileSize?: number;
  videoMimeType?: string;
}

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name)
    private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Enrollment.name)
    private enrollmentModel: Model<EnrollmentDocument>,
    private coursesService: CoursesService,
    private s3Service: S3Service,
    private cloudFrontService: CloudFrontService,
    private videoProcessorService: VideoProcessorService,
    private storageIntegrationService: StorageIntegrationService,
    private usageHooksService: UsageHooksService,
    private authService: AuthService,
    private authorizationService: AuthorizationService,
    private notificationsService: NotificationsService,
  ) {}

  // Add permission check method
  private async checkUpdatePermission(
    classItem: ClassDocument,
    userId: string,
  ): Promise<void> {
    // Check if the user is the teacher of the class or has admin role
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // If user is admin or super_admin, always allow
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    // Check if user is the teacher of the class
    if (classItem.teacher.toString() !== userId) {
      throw new UnauthorizedException(
        'You are not authorized to update this class',
      );
    }
  }

  private isVideoDeletionPermissionError(error: any): boolean {
    return Boolean(
      error?.message?.includes('not authorized to perform: s3:DeleteObject') ||
        error?.message?.includes('identity-based policy') ||
        error?.code === 'AccessDenied',
    );
  }

  async create(
    createClassDto: CreateClassDto,
    teacherId: string,
    videoFile: Express.Multer.File,
  ): Promise<Class> {
    try {
      // Validación de datos requeridos
      if (!teacherId) {
        throw new BadRequestException('Se requiere ID del profesor');
      }

      if (!videoFile) {
        throw new BadRequestException('Se requiere un archivo de video');
      }

      const course = await this.coursesService.findOne(createClassDto.courseId);

      if (!course) {
        throw new NotFoundException(
          `Course with ID ${createClassDto.courseId} not found`,
        );
      }

      // Extraer ID del profesor del curso de forma segura
      let teacherIdFromCourse = 'null';
      if (course.teacher) {
        if (typeof course.teacher === 'object' && course.teacher !== null) {
          const teacherObj = course.teacher as any;
          teacherIdFromCourse = teacherObj._id
            ? String(teacherObj._id)
            : 'objeto sin id';
        } else {
          teacherIdFromCourse = String(course.teacher);
        }
      }

      // Verificar permisos para crear clase
      const user = await this.userModel.findById(teacherId);
      const allowedRoles = [
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.SCHOOL_OWNER,
        UserRole.ADMINISTRATIVE,
      ];
      // Si es admin, super_admin, school_owner o administrative, permitir
      if (user && allowedRoles.includes(user.role)) {
        // permitido
      } else {
        // Si es teacher principal o está en el array teachers del curso, permitir
        const isMainTeacher = teacherIdFromCourse === teacherId;
        let isAdditionalTeacher = false;
        if (Array.isArray(course.teachers)) {
          isAdditionalTeacher = course.teachers
            .map(String)
            .includes(String(teacherId));
        }
        if (!isMainTeacher && !isAdditionalTeacher) {
          throw new BadRequestException(
            'No tienes permisos para crear clases en este curso',
          );
        }
      }

      // Procesar y subir el video a S3
      try {
        // Procesar el video
        const { processedFilePath, cleanup } =
          await this.videoProcessorService.processVideo(videoFile.buffer);

        try {
          // Leer el archivo procesado
          const processedVideoBuffer =
            await fs.promises.readFile(processedFilePath);

          // Subir el video procesado a S3
          const uploadResult = await this.s3Service.uploadVideo({
            ...videoFile,
            buffer: processedVideoBuffer,
          });

          // Crear y guardar la nueva clase
          const newClass = new this.classModel({
            ...createClassDto,
            videoUrl: uploadResult,
            videoFileName: videoFile.originalname,
            videoFileSize: videoFile.size,
            videoMimeType: videoFile.mimetype,
            teacher: teacherId,
            course: createClassDto.courseId,
          });

          const savedClass = await newClass.save();

          // Track storage usage for the uploaded video
          try {
            await this.usageHooksService.trackStorageUsage({
              assetId: this.s3Service.getKeyFromUrl(uploadResult),
              assetType: 'video',
              fileSizeBytes: videoFile.size,
              fileName: videoFile.originalname,
              uploadedBy: teacherId,
              schoolId:
                typeof course.school === 'object' &&
                course.school !== null &&
                '_id' in course.school
                  ? (course.school as any)._id.toString()
                  : course.school.toString(),
              relatedCourse: createClassDto.courseId,
              relatedClass: savedClass._id.toString(),
            });
          } catch (trackingError) {
            this.logger.warn(
              `Failed to track storage usage for class ${savedClass._id}: ${trackingError.message}`,
            );
          }

          try {
            await this.notificationsService.notifyNewClassInCourse(
              createClassDto.courseId,
              String(savedClass._id),
              savedClass.title,
              teacherId,
            );
          } catch (notificationError) {
            this.logger.warn(
              `Failed to notify new class ${savedClass._id}: ${notificationError.message}`,
            );
          }

          return savedClass;
        } finally {
          // Limpiar archivos temporales
          await cleanup();
        }
      } catch (uploadError) {
        this.logger.error(
          `Error al procesar o subir video: ${uploadError.message}`,
          uploadError.stack,
        );
        throw new InternalServerErrorException(
          `Error al procesar o subir el video: ${uploadError.message}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error al crear clase: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error al crear la clase: ${error.message}`,
      );
    }
  }

  async findAll(userId?: string, role?: UserRole, courseId?: string) {
    try {
      const isAdminViewer =
        role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
      let query: any = isAdminViewer ? {} : { isActive: true };

      // Si se especifica un curso, filtramos por él
      if (courseId) {
        query.course = courseId;
      }

      // Si es un usuario no admin o super_admin, filtramos por clases públicas o donde el profesor sea el usuario
      if (userId && !isAdminViewer) {
        if (role === UserRole.TEACHER) {
          query = {
            ...query,
            $or: [{ isPublic: true }, { teacher: userId }],
          };
        } else if (role === UserRole.STUDENT && courseId) {
          // Si es estudiante y hay courseId, verificar si está inscrito
          const enrollment = await this.enrollmentModel.findOne({
            course: courseId,
            student: userId,
            isActive: true,
          });
          if (enrollment) {
            // Está inscrito: puede ver todas las clases del curso
            query = { ...query };
          } else {
            // No inscrito: solo públicas
            query = { ...query, isPublic: true };
          }
        } else {
          query = {
            ...query,
            isPublic: true,
          };
        }
      }

      const classes = await this.classModel
        .find(query)
        .populate('teacher', 'name email')
        .populate('course', 'title')
        .sort({ order: 1 });

      // Generar URLs firmadas para todos los videos
      const classesWithSignedUrls = [];
      for (const classItem of classes) {
        try {
          if (classItem.videoUrl) {
            const signedUrl = await this.s3Service.getSignedUrl(
              classItem.videoUrl,
            );
            const classObj = classItem.toObject();
            classObj.videoUrl = signedUrl;
            classesWithSignedUrls.push(classObj);
          } else {
            classesWithSignedUrls.push(classItem.toObject());
          }
        } catch (error) {
          this.logger.error(
            `Error al generar URL firmada para clase ${classItem._id}: ${error.message}`,
          );
          classesWithSignedUrls.push(classItem.toObject());
        }
      }

      return classesWithSignedUrls;
    } catch (error) {
      this.logger.error(
        `Error al buscar clases: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Método para obtener la URL para streaming de video
  private async getVideoStreamingUrl(videoKey: string): Promise<string> {
    try {
      // Priorizar siempre CloudFront para videos
      if (this.cloudFrontService) {
        try {
          // Generamos una URL firmada que expire en 24 horas
          const cloudFrontUrl = await this.cloudFrontService.getSignedUrl(
            videoKey,
            86400,
          );

          return cloudFrontUrl;
        } catch (cloudFrontError) {
          // Si hay error con CloudFront, continuamos con S3
        }
      } else {
      }

      // S3 como fallback
      const s3Url = await this.s3Service.getSignedUrl(videoKey, 3600);

      return s3Url;
    } catch (error) {
      this.logger.error(
        `Error al generar URL de streaming: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al generar URL de streaming: ${error.message}`,
      );
    }
  }

  async findOne(
    id: string,
    userId?: string,
    userRole?: UserRole,
  ): Promise<Class> {
    try {
      // If user information is provided, use access control
      if (userId !== undefined || userRole !== undefined) {
        return this.getClassForUser(id, userId, userRole);
      }

      // Fallback to basic findOne for backward compatibility
      const classItem = await this.classModel
        .findById(id)
        .populate('teacher', 'name email')
        .exec();

      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }

      if (!classItem.isActive) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }

      // If the class has a video key, generate a streaming URL
      if (classItem.videoKey) {
        const streamingUrl = await this.getVideoStreamingUrl(
          classItem.videoKey,
        );
        classItem.videoUrl = streamingUrl;
      }

      return classItem;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error al buscar clase: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error al buscar la clase: ${error.message}`,
      );
    }
  }

  async getClassForUser(
    id: string,
    userId?: string,
    userRole?: UserRole,
  ): Promise<Class> {
    try {
      const classItem = await this.classModel
        .findById(id)
        .populate('teacher', 'name email')
        .populate('course', 'title isPublic')
        .exec();

      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }

      if (
        !classItem.isActive &&
        userRole !== UserRole.ADMIN &&
        userRole !== UserRole.SUPER_ADMIN
      ) {
        throw new UnauthorizedException(
          'No tienes permiso para ver esta clase o requiere autenticación.',
        );
      }

      // Admin and super admin can see all classes
      if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) {
        if (classItem.videoKey) {
          const streamingUrl = await this.getVideoStreamingUrl(
            classItem.videoKey,
          );
          classItem.videoUrl = streamingUrl;
        }
        return classItem;
      }

      // If user is authenticated
      if (userId) {
        // Teacher can see their own classes
        if (
          userRole === UserRole.TEACHER &&
          classItem.teacher.toString() === userId
        ) {
          if (classItem.videoKey) {
            const streamingUrl = await this.getVideoStreamingUrl(
              classItem.videoKey,
            );
            classItem.videoUrl = streamingUrl;
          }
          return classItem;
        }

        // If user is a student, check if they're enrolled in the course
        if (userRole === UserRole.STUDENT) {
          const enrollment = await this.enrollmentModel.findOne({
            course: classItem.course,
            student: userId,
            isActive: true,
          });

          if (enrollment) {
            // Student is enrolled, can see the class
            if (classItem.videoKey) {
              const streamingUrl = await this.getVideoStreamingUrl(
                classItem.videoKey,
              );
              classItem.videoUrl = streamingUrl;
            }
            return classItem;
          }
        }
      }

      // Check if class is public
      if (classItem.isPublic) {
        // For public classes, check if the course is also public
        const course = classItem.course as any;
        if (course && course.isPublic) {
          if (classItem.videoKey) {
            const streamingUrl = await this.getVideoStreamingUrl(
              classItem.videoKey,
            );
            classItem.videoUrl = streamingUrl;
          }
          return classItem;
        }
      }

      // If none of the above conditions are met, deny access
      throw new UnauthorizedException(
        'No tienes permiso para ver esta clase o requiere autenticación.',
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(`Error al buscar clase: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error al buscar la clase: ${error.message}`,
      );
    }
  }

  async update(id: string, updateClassDto: any, userId: string) {
    try {
      const classItem = await this.classModel.findById(id);

      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }

      // Verificar permisos
      await this.checkUpdatePermission(classItem, userId);

      const updatedClass = await this.classModel.findByIdAndUpdate(
        id,
        updateClassDto,
        { new: true },
      );

      return updatedClass;
    } catch (error) {
      this.logger.error(
        `Error al actualizar clase ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createForRequest(
    createClassDto: CreateClassDto,
    userId: string,
    file: Express.Multer.File,
  ) {
    try {
      return await this.createWithWorkerProcessing(createClassDto, userId, file);
    } catch (error) {
      this.logger.error(
        `Error al crear la clase: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateForRequest(
    id: string,
    updateClassDto: UpdateClassDto,
    userId: string,
    file?: Express.Multer.File,
  ) {
    try {
      if (file) {
        return await this.updateWithVideo(id, updateClassDto, userId, file);
      }

      return await this.update(id, updateClassDto, userId);
    } catch (error) {
      this.logger.error(
        `Error al actualizar clase: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeForRequest(id: string, userId: string) {
    try {
      const result = await this.remove(id, userId);
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

      if (this.isVideoDeletionPermissionError(error)) {
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

  async getStudentAttendanceForRequester(
    classId: string,
    studentId: string,
    requesterId: string,
    requesterRole: UserRole,
  ) {
    if (requesterRole === UserRole.STUDENT && requesterId !== studentId) {
      throw new UnauthorizedException(
        'You can only view your own attendance records',
      );
    }

    return this.getStudentAttendance(classId, studentId);
  }

  async remove(id: string, userId: string) {
    try {
      const classToDelete = await this.classModel.findById(id);

      if (!classToDelete) {
        this.logger.warn(`Clase con ID ${id} no encontrada para eliminación`);
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }

      // Verificar permisos
      const course = await this.coursesService.findOne(
        String(classToDelete.course),
      );

      if (!course) {
        throw new NotFoundException(
          `Curso ${classToDelete.course} no encontrado`,
        );
      }

      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`Usuario ${userId} no encontrado`);
      }

      const canModifyCourse = await this.authorizationService.canModifyCourse(
        userId,
        String(course._id),
      );

      if (!canModifyCourse) {
        throw new ForbiddenException(
          'No tienes permisos para eliminar esta clase',
        );
      }

      // Eliminar el video de S3 si existe
      let videoDeleteError = null;
      if (classToDelete.videoUrl) {
        try {
          await this.s3Service.deleteVideo(classToDelete.videoUrl);
        } catch (s3Error) {
          // Registramos el error pero continuamos con la eliminación de la clase
          this.logger.warn(
            `No se pudo eliminar el video asociado a la clase: ${s3Error.message}`,
          );
          videoDeleteError = s3Error.message;
        }
      }

      // Eliminar la clase de la base de datos
      await this.classModel.findByIdAndDelete(id);

      // Incluir mensaje de advertencia si hubo error al eliminar el video
      if (videoDeleteError) {
        return {
          success: true,
          message:
            'La clase fue eliminada correctamente, pero el video podría permanecer en el servidor. Esto no afecta el funcionamiento del sistema.',
          videoWarning: true,
        };
      }

      return { success: true, message: 'Clase eliminada correctamente' };
    } catch (error) {
      this.logger.error(
        `Error al eliminar clase ${id}: ${error.message}`,
        error.stack,
      );

      // Mejorar los mensajes de error para mejor diagnóstico
      if (error.name === 'AccessDenied' || error.code === 'AccessDenied') {
        throw new InternalServerErrorException(
          'No se pudo eliminar el archivo de video asociado a la clase debido a permisos insuficientes. Contacta al administrador del sistema.',
        );
      }

      throw error;
    }
  }

  async getSignedUrlForStreaming(videoUrl: string): Promise<string> {
    try {
      // Intentar usar CloudFront si está disponible
      if (this.cloudFrontService) {
        try {
          const key = this.s3Service.getKeyFromUrl(videoUrl);
          // Generar URL firmada de CloudFront con mayor tiempo de expiración
          const cloudFrontUrl = await this.cloudFrontService.getSignedUrl(
            key,
            86400,
          ); // 24 horas

          return cloudFrontUrl;
        } catch (cloudFrontError) {}
      }

      // Fallback a S3 si CloudFront no está disponible
      const streamUrl = await this.s3Service.getSignedUrl(videoUrl, 3600); // 1 hora

      return streamUrl;
    } catch (error) {
      this.logger.error(
        `Error al generar URL de streaming: ${error.message}`,
        error.stack,
      );
      // En caso de error, devolver la URL original
      return videoUrl;
    }
  }

  async updateVideoUrl(
    classId: string,
    videoFile: Express.Multer.File,
    user: UserDocument,
  ): Promise<ClassWithVideo> {
    try {
      const classToUpdate = (await this.classModel.findById(
        classId,
      )) as ClassWithVideo;
      if (!classToUpdate) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      // Verificar permisos
      const course = await this.coursesService.findOne(
        String(classToUpdate.course),
      );
      if (!course) {
        throw new NotFoundException(`Course not found for class ${classId}`);
      }

      const isTeacher = String(course.teacher) === String(user._id);
      const isAdmin =
        compareRole(user.role, UserRole.ADMIN) ||
        compareRole(user.role, UserRole.SUPER_ADMIN);

      if (!isTeacher && !isAdmin) {
        throw new UnauthorizedException(
          'You do not have permission to update this class video',
        );
      }

      // Si hay un video existente, eliminarlo de S3
      if (classToUpdate.videoUrl) {
        try {
          await this.s3Service.deleteVideo(classToUpdate.videoUrl);
        } catch (error) {}
      }

      // Procesar y subir el nuevo video
      try {
        // Procesar el video
        const { processedFilePath, cleanup } =
          await this.videoProcessorService.processVideo(videoFile.buffer);

        try {
          // Leer el archivo procesado
          const processedVideoBuffer =
            await fs.promises.readFile(processedFilePath);

          // Subir el video procesado a S3
          const uploadResult = await this.s3Service.uploadVideo({
            ...videoFile,
            buffer: processedVideoBuffer,
          });

          // Actualizar la clase con la nueva URL del video
          classToUpdate.videoUrl = uploadResult;
          classToUpdate.videoFileName = videoFile.originalname;
          classToUpdate.videoFileSize = videoFile.size;
          classToUpdate.videoMimeType = videoFile.mimetype;

          const updatedClass = await classToUpdate.save();

          return updatedClass as ClassWithVideo;
        } finally {
          // Limpiar archivos temporales
          await cleanup();
        }
      } catch (uploadError) {
        this.logger.error(
          `Error al procesar o subir el nuevo video: ${uploadError.message}`,
          uploadError.stack,
        );
        throw new InternalServerErrorException(
          `Error al procesar o subir el nuevo video: ${uploadError.message}`,
        );
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        `Error al actualizar el video de la clase: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al actualizar el video de la clase: ${error.message}`,
      );
    }
  }

  // Attendance-related methods
  async recordAttendance(
    classId: string,
    recordAttendanceDto: RecordAttendanceDto,
    teacherId: string,
  ) {
    const classItem = await this.classModel.findById(classId);
    if (!classItem) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }
    // Usar la fecha y hora exacta en UTC
    const attendanceDate = new Date();

    // Get the course ID from the class
    const courseId = classItem.course;

    // Create attendance records
    const attendancePromises = recordAttendanceDto.attendanceRecords.map(
      (record) => {
        return this.attendanceModel.create({
          course: courseId,
          student: record.studentId,
          date: attendanceDate,
          present: record.present,
          notes: record.notes,
          recordedBy: teacherId,
          markedBy: teacherId,
        });
      },
    );

    const attendanceRecords = await Promise.all(attendancePromises);
    return {
      success: true,
      count: attendanceRecords.length,
      records: attendanceRecords,
    };
  }

  async getAttendance(
    classId: string,
    dateString?: string,
    start?: string,
    end?: string,
  ) {
    const classItem = await this.classModel.findById(classId);
    if (!classItem) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }
    const courseId = classItem.course;
    const query: any = { course: courseId };
    if (start && end) {
      // Si se reciben start y end, filtrar por ese rango UTC
      query.date = {
        $gte: new Date(start),
        $lt: new Date(end),
      };
    } else if (dateString) {
      // Use the same timezone conversion logic as AttendanceService
      const date = new Date(dateString);
      const GMT_5_OFFSET_MINUTES = 5 * 60;
      const gmt5Date = new Date(date.getTime() - GMT_5_OFFSET_MINUTES * 60000);
      const localDateStr = gmt5Date.toISOString().split('T')[0];

      const [year, month, day] = localDateStr.split('-').map(Number);
      const startLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endLocal = new Date(
        Date.UTC(year, month - 1, day, 23, 59, 59, 999),
      );

      const startUTC = new Date(
        startLocal.getTime() + GMT_5_OFFSET_MINUTES * 60000,
      );
      const endUTC = new Date(
        endLocal.getTime() + GMT_5_OFFSET_MINUTES * 60000,
      );

      query.date = {
        $gte: startUTC,
        $lt: endUTC,
      };
    }
    return this.attendanceModel
      .find(query)
      .populate('student', 'name email')
      .populate('recordedBy', 'name email')
      .exec();
  }

  async getStudentAttendance(classId: string, studentId: string) {
    const classItem = await this.classModel.findById(classId);
    if (!classItem) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // Get the course ID from the class
    const courseId = classItem.course;

    return this.attendanceModel
      .find({
        course: courseId,
        student: studentId,
      })
      .populate('recordedBy', 'name email')
      .sort({ date: -1 })
      .exec();
  }

  async updateAttendance(
    classId: string,
    attendanceId: string,
    updateAttendanceDto: UpdateAttendanceDto,
    teacherId: string,
  ) {
    const classItem = await this.classModel.findById(classId);
    if (!classItem) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    const attendance = await this.attendanceModel.findById(attendanceId);
    if (!attendance) {
      throw new NotFoundException(
        `Attendance record with ID ${attendanceId} not found`,
      );
    }

    // Get the course ID from the class and check if attendance belongs to this course
    const courseId = classItem.course;
    if (attendance.course.toString() !== courseId.toString()) {
      throw new BadRequestException(
        'Attendance record does not belong to this course',
      );
    }

    // Update fields that are provided
    if (updateAttendanceDto.present !== undefined) {
      attendance.present = updateAttendanceDto.present;
    }

    if (updateAttendanceDto.notes !== undefined) {
      attendance.notes = updateAttendanceDto.notes;
    }

    // Update recordedBy to reflect who made the latest change
    attendance.recordedBy = teacherId as any;

    await attendance.save();
    return attendance;
  }

  async deleteAttendance(classId: string, attendanceId: string) {
    const classItem = await this.classModel.findById(classId);
    if (!classItem) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    const attendance = await this.attendanceModel.findById(attendanceId);
    if (!attendance) {
      throw new NotFoundException(
        `Attendance record with ID ${attendanceId} not found`,
      );
    }

    // Get the course ID from the class and check if attendance belongs to this course
    const courseId = classItem.course;
    if (attendance.course.toString() !== courseId.toString()) {
      throw new BadRequestException(
        'Attendance record does not belong to this course',
      );
    }

    await this.attendanceModel.findByIdAndDelete(attendanceId);
    return { success: true, message: 'Attendance record deleted successfully' };
  }

  async updateWithVideo(
    id: string,
    updateClassDto: UpdateClassDto,
    userId: string,
    file: Express.Multer.File,
  ) {
    const classItem = await this.classModel.findById(id).exec();

    if (!classItem) {
      throw new NotFoundException(`Clase con ID ${id} no encontrada`);
    }

    // Verificar permisos
    await this.checkUpdatePermission(classItem, userId);
    await this.authService.ensureCreatorTermsAccepted(userId);

    try {
      // Guarda la información sobre el video anterior para eliminarlo después si es necesario
      const oldVideoUrl = classItem.videoUrl;

      // Procesar el nuevo video - pass buffer instead of file
      const videoProcessingResult =
        await this.videoProcessorService.processVideo(file.buffer);

      // Actualizar la clase con los nuevos datos
      classItem.title = updateClassDto.title;
      classItem.description = updateClassDto.description;

      // Use course instead of courseId
      if (updateClassDto.courseId) {
        classItem.course = updateClassDto.courseId as any;
      }

      // Handle different videoProcessingResult structure
      if (videoProcessingResult && videoProcessingResult.processedFilePath) {
        // Read the processed file
        const processedVideoBuffer = await fs.promises.readFile(
          videoProcessingResult.processedFilePath,
        );

        // Upload to S3
        try {
          // Create an object that S3Service will accept
          const uploadResult = await this.s3Service.uploadVideo({
            buffer: processedVideoBuffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          } as any); // Use type assertion to bypass type checking

          classItem.videoUrl = uploadResult;

          // Track storage usage for the uploaded video
          try {
            const course = await this.coursesService.findOne(
              classItem.course.toString(),
            );
            await this.usageHooksService.trackStorageUsage({
              assetId: this.s3Service.getKeyFromUrl(uploadResult),
              assetType: 'video',
              fileSizeBytes: file.size,
              fileName: file.originalname,
              uploadedBy: userId,
              schoolId: (course.school as any)?._id?.toString() ?? course.school?.toString(),
              relatedCourse: classItem.course.toString(),
              relatedClass: classItem._id.toString(),
            });
          } catch (trackingError) {
            this.logger.warn(
              `Failed to track storage usage for class ${classItem._id}: ${trackingError.message}`,
            );
          }

          // Set video metadata
          if (!classItem.videoMetadata) {
            classItem.videoMetadata = {
              name: file.originalname,
              size: file.size,
              mimeType: file.mimetype,
            };
          }
        } catch (error) {
          this.logger.error(
            `Error uploading processed video: ${error.message}`,
          );
          throw error;
        } finally {
          // Clean up temporary files
          if (typeof videoProcessingResult.cleanup === 'function') {
            videoProcessingResult.cleanup();
          }
        }
      }

      // Update timestamps
      classItem.updatedAt = new Date();

      // Set updatedBy as dynamic property
      (classItem as any).updatedBy = userId;

      // Guardar los cambios
      const updatedClass = await classItem.save();

      // Eliminar el video anterior si se ha cambiado
      if (oldVideoUrl && oldVideoUrl !== updatedClass.videoUrl) {
        try {
          // Handle case where deleteVideo doesn't exist
          // Just log the old URL as we can't directly delete it without the proper method
        } catch (error) {}
      }

      return updatedClass;
    } catch (error) {
      this.logger.error(
        `Error al actualizar la clase con nuevo video: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Error al actualizar la clase: ${error.message}`,
      );
    }
  }

  /**
   * Create class with worker-based video processing
   */
  async createWithWorkerProcessing(
    createClassDto: CreateClassDto,
    teacherId: string,
    videoFile?: Express.Multer.File,
  ): Promise<Class> {
    this.logger.log(
      `Creating class with worker processing: ${createClassDto.title}`,
    );
    this.logger.log(`Teacher ID: ${teacherId}`);
    this.logger.log(
      `Video file: ${videoFile ? videoFile.originalname : 'None'}`,
    );

    if (videoFile) {
      await this.authService.ensureCreatorTermsAccepted(teacherId);
    }

    const course = await this.coursesService.findOne(createClassDto.courseId);
    if (!course) {
      throw new NotFoundException(
        `Course not found: ${createClassDto.courseId}`,
      );
    }

    // Verify teacher permissions (simplified version)
    if (course.teacher && course.teacher.toString() !== teacherId) {
      const user = await this.userModel.findById(teacherId);
      const allowedRoles = [
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.SCHOOL_OWNER,
        UserRole.ADMINISTRATIVE,
      ];

      if (!user || !allowedRoles.includes(user.role)) {
        throw new ForbiddenException(
          'You are not authorized to create a class for this course',
        );
      }
    }

    // Create class first without video
    const classData: any = {
      ...createClassDto,
      teacher: teacherId,
      course: createClassDto.courseId,
      videoUrl: null,
      tempVideoKey: null,
      videoProcessingError: null,
    };

    // Only set videoStatus if video is provided, otherwise let schema default handle it
    if (videoFile) {
      classData.videoStatus = VideoStatus.UPLOADING;
    }

    const newClass = new this.classModel(classData);

    const savedClass = await newClass.save();

    // If video file provided, upload to temp bucket for worker processing
    if (videoFile) {
      try {
        const schoolId =
          typeof course.school === 'object' &&
          course.school !== null &&
          '_id' in course.school
            ? (course.school as any)._id.toString()
            : course.school.toString();

        // Generate presigned URL for temp bucket upload
        const { uploadUrl, key } =
          await this.s3Service.generatePresignedUploadUrl(
            videoFile.originalname,
            videoFile.mimetype,
            schoolId,
            savedClass._id.toString(),
          );

        // Upload directly to temp bucket using fetch
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: videoFile.buffer as unknown as BodyInit,
          headers: {
            'Content-Type': videoFile.mimetype,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        // Update class with temp key and uploading status
        await this.updateVideoStatus(
          savedClass._id.toString(),
          VideoStatus.UPLOADING,
          key,
        );

        this.logger.log(
          `Video uploaded to temp bucket for worker processing: ${key}`,
        );
      } catch (error) {
        this.logger.error(
          `Error uploading to temp bucket: ${error.message}`,
          error.stack,
        );

        // Update class with error status
        await this.updateVideoStatus(
          savedClass._id.toString(),
          VideoStatus.ERROR,
          undefined,
          `Upload failed: ${error.message}`,
        );

        throw new InternalServerErrorException(
          `Error uploading video: ${error.message}`,
        );
      }
    }

    return savedClass;
  }

  /**
   * Update video status and temp key
   */
  async updateVideoStatus(
    classId: string,
    status: VideoStatus,
    tempVideoKey?: string,
    error?: string,
  ): Promise<void> {
    try {
      const updateData: any = {
        videoStatus: status,
        updatedAt: new Date(),
      };

      if (tempVideoKey) {
        updateData.tempVideoKey = tempVideoKey;
      }

      if (error) {
        updateData.videoProcessingError = error;
      }

      await this.classModel.findByIdAndUpdate(classId, updateData);

      this.logger.log(`Video status updated for class ${classId}: ${status}`);
    } catch (error) {
      this.logger.error(
        `Error updating video status for class ${classId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update video URL and status
   */
  async updateVideoUrlAndStatus(
    classId: string,
    videoUrl: string,
    status: VideoStatus,
  ): Promise<void> {
    try {
      const result = await this.classModel.findByIdAndUpdate(
        classId,
        {
          videoUrl,
          videoStatus: status,
          updatedAt: new Date(),
        },
        { new: true },
      );

      if (!result) {
        throw new NotFoundException(`Clase con ID ${classId} no encontrada`);
      }

      this.logger.log(
        `Updated video URL and status for class ${classId}: ${status}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating video URL and status for class ${classId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create a test class for development/testing purposes (without video file)
   */
  async createTestClass(testClassData: any): Promise<ClassDocument> {
    try {
      const testClass = new this.classModel(testClassData);
      const savedClass = await testClass.save();

      this.logger.log(`Test class created: ${savedClass._id}`);
      return savedClass;
    } catch (error) {
      this.logger.error('Error creating test class:', error);
      throw error;
    }
  }
}
