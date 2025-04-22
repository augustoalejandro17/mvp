import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Class, ClassDocument } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { CoursesService } from '../courses/courses.service';
import { S3Service } from '../services/s3.service';
import { User, UserRole } from '../auth/schemas/user.schema';
import { CloudFrontService } from '../services/cloudfront.service';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    private coursesService: CoursesService,
    private s3Service: S3Service,
    private cloudFrontService: CloudFrontService,
  ) {}

  async create(createClassDto: CreateClassDto, teacherId: string, videoFile: Express.Multer.File): Promise<Class> {
    try {
      this.logger.log(`Iniciando creación de clase por profesor ID: ${teacherId}`);
      
      // Validación de datos requeridos
      if (!teacherId) {
        throw new BadRequestException('Se requiere ID del profesor');
      }

      if (!videoFile) {
        throw new BadRequestException('Se requiere un archivo de video');
      }
      
      const course = await this.coursesService.findOne(createClassDto.courseId);
      
      if (!course) {
        throw new NotFoundException(`Course with ID ${createClassDto.courseId} not found`);
      }
      
      // Extraer ID del profesor del curso de forma segura
      let teacherIdFromCourse = 'null';
      if (course.teacher) {
        if (typeof course.teacher === 'object' && course.teacher !== null) {
          const teacherObj = course.teacher as any;
          teacherIdFromCourse = teacherObj._id ? 
            String(teacherObj._id) : 
            'objeto sin id';
        } else {
          teacherIdFromCourse = String(course.teacher);
        }
      }
      
      // Verificar que el profesor que crea la clase sea el profesor del curso o un admin
      if (teacherIdFromCourse !== teacherId) {
        const user = await this.userModel.findById(teacherId);
        if (!user || user.role !== 'admin') {
          this.logger.warn(`Profesor ${teacherId} no autorizado para crear clase en curso ${course._id}`);
          throw new BadRequestException('No tienes permisos para crear clases en este curso');
        }
      }

      // Subir el video a S3
      try {
        this.logger.log(`Subiendo video: ${videoFile.originalname} (${videoFile.size} bytes)`);
        
        // Usar el servicio de S3 para subir el archivo
        const uploadResult = await this.s3Service.uploadVideo(videoFile);
        
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
        
        this.logger.log(`Clase creada exitosamente: ${savedClass._id}`);
        return savedClass;
      } catch (uploadError) {
        this.logger.error(`Error al subir video: ${uploadError.message}`, uploadError.stack);
        throw new InternalServerErrorException(`Error al subir el video: ${uploadError.message}`);
      }
      
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      this.logger.error(`Error al crear clase: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al crear la clase: ${error.message}`);
    }
  }

  async findAll(userId?: string, role?: UserRole, courseId?: string) {
    this.logger.log(`Buscando todas las clases${courseId ? ` del curso ${courseId}` : ''}`);
    try {
      let query: any = {};
      
      // Si se especifica un curso, filtramos por él
      if (courseId) {
        query.course = courseId;
      }
      
      // Si es un usuario no admin, filtramos por clases públicas o donde el profesor sea el usuario
      if (userId && role !== UserRole.ADMIN) {
        if (role === UserRole.TEACHER) {
          query = { 
            ...query,
            $or: [
              { isPublic: true },
              { teacher: userId }
            ] 
          };
        } else {
          query = { 
            ...query,
            isPublic: true
          };
        }
      }
      
      const classes = await this.classModel.find(query)
        .populate('teacher', 'name email')
        .populate('course', 'title')
        .sort({ order: 1 });
      
      // Generar URLs firmadas para todos los videos
      const classesWithSignedUrls = [];
      for (const classItem of classes) {
        try {
          if (classItem.videoUrl) {
            const signedUrl = await this.s3Service.getSignedUrl(classItem.videoUrl);
            const classObj = classItem.toObject();
            classObj.videoUrl = signedUrl;
            classesWithSignedUrls.push(classObj);
          } else {
            classesWithSignedUrls.push(classItem.toObject());
          }
        } catch (error) {
          this.logger.error(`Error al generar URL firmada para clase ${classItem._id}: ${error.message}`);
          classesWithSignedUrls.push(classItem.toObject());
        }
      }
      
      this.logger.log(`Se encontraron ${classes.length} clases y se generaron URLs firmadas`);
      return classesWithSignedUrls;
    } catch (error) {
      this.logger.error(`Error al buscar clases: ${error.message}`, error.stack);
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
          const cloudFrontUrl = await this.cloudFrontService.getSignedUrl(videoKey, 86400);
          this.logger.log(`URL de CloudFront generada para ${videoKey}`);
          return cloudFrontUrl;
        } catch (cloudFrontError) {
          this.logger.warn(`CloudFront no disponible: ${cloudFrontError.message}. Usando S3.`);
          // Si hay error con CloudFront, continuamos con S3
        }
      } else {
        this.logger.warn('CloudFrontService no inicializado correctamente. Usando S3 directamente.');
      }
      
      // S3 como fallback
      const s3Url = await this.s3Service.getSignedUrl(videoKey, 3600);
      this.logger.log(`URL de S3 generada para ${videoKey}`);
      return s3Url;
      
    } catch (error) {
      this.logger.error(`Error al generar URL de streaming: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al generar URL de streaming: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Class> {
    this.logger.log(`Buscando clase con ID: ${id}`);
    try {
      const classItem = await this.classModel
        .findById(id)
        .populate('teacher', 'name email')
        .exec();
      
      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }
      
      // Si la clase tiene una clave de video guardada, generar una URL firmada actualizada
      // Esto asegura que siempre tendremos una URL de reproducción válida
      if (classItem.videoKey) {
        const streamingUrl = await this.getVideoStreamingUrl(classItem.videoKey);
        // No modificamos el documento en la base de datos, solo el objeto que se devuelve
        classItem.videoUrl = streamingUrl;
      }
      
      return classItem;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error al buscar clase: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al buscar la clase: ${error.message}`);
    }
  }

  async update(id: string, updateClassDto: any, userId: string) {
    this.logger.log(`Actualizando clase con ID: ${id}`);
    try {
      const classItem = await this.classModel.findById(id);
      
      if (!classItem) {
        this.logger.warn(`Clase con ID ${id} no encontrada`);
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }
      
      // Verificar permisos
      if (classItem.teacher.toString() !== userId) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para actualizar esta clase');
        }
      }
      
      const updatedClass = await this.classModel.findByIdAndUpdate(
        id,
        updateClassDto,
        { new: true }
      );
      
      this.logger.log(`Clase actualizada exitosamente: ${updatedClass._id}`);
      return updatedClass;
    } catch (error) {
      this.logger.error(`Error al actualizar clase ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    this.logger.log(`Eliminando clase con ID: ${id}`);
    try {
      const classItem = await this.classModel.findById(id);
      
      if (!classItem) {
        this.logger.warn(`Clase con ID ${id} no encontrada`);
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }
      
      // Verificar permisos
      if (classItem.teacher.toString() !== userId) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para eliminar esta clase');
        }
      }
      
      // Eliminar el video de S3
      if (classItem.videoUrl) {
        await this.s3Service.deleteVideo(classItem.videoUrl);
      }
      
      await this.classModel.findByIdAndDelete(id);
      
      this.logger.log(`Clase eliminada exitosamente: ${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al eliminar clase ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getVideoDownloadUrl(videoUrl: string): Promise<string> {
    this.logger.log(`Generando URL de descarga para video: ${videoUrl}`);
    
    try {
      // Extraer el nombre del archivo de la URL
      const key = this.s3Service.getKeyFromUrl(videoUrl);
      const fileName = key.split('/').pop() || 'video.mov';
      
      // Generar una URL firmada con parámetro de descarga
      const downloadUrl = await this.s3Service.getDownloadUrl(videoUrl);
      
      this.logger.log(`URL de descarga generada exitosamente para ${fileName}`);
      return downloadUrl;
    } catch (error) {
      this.logger.error(`Error al generar URL de descarga: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSignedUrlForStreaming(videoUrl: string): Promise<string> {
    this.logger.log(`Generando URL de streaming para video: ${videoUrl}`);
    
    try {
      // Intentar usar CloudFront si está disponible
      if (this.cloudFrontService) {
        try {
          const key = this.s3Service.getKeyFromUrl(videoUrl);
          // Generar URL firmada de CloudFront con mayor tiempo de expiración
          const cloudFrontUrl = await this.cloudFrontService.getSignedUrl(key, 86400); // 24 horas
          this.logger.log(`URL de CloudFront generada para streaming`);
          return cloudFrontUrl;
        } catch (cloudFrontError) {
          this.logger.warn(`CloudFront no disponible: ${cloudFrontError.message}. Fallback a S3.`);
        }
      }
      
      // Fallback a S3 si CloudFront no está disponible
      const streamUrl = await this.s3Service.getSignedUrl(videoUrl, 3600); // 1 hora
      this.logger.log(`URL de S3 generada para streaming`);
      return streamUrl;
    } catch (error) {
      this.logger.error(`Error al generar URL de streaming: ${error.message}`, error.stack);
      // En caso de error, devolver la URL original
      return videoUrl;
    }
  }

  async updateVideoUrl(id: string, videoFile: Express.Multer.File): Promise<Class> {
    try {
      // Verificar que exista la clase
      const classItem = await this.classModel.findById(id);
      if (!classItem) {
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }

      // Subir el nuevo video a S3
      const uploadResult = await this.s3Service.uploadFile(
        videoFile.buffer,
        videoFile.originalname,
        videoFile.mimetype
      );

      // Actualizar la información del video
      classItem.videoUrl = uploadResult.url;
      classItem.videoKey = uploadResult.key;
      classItem.videoMetadata = {
        name: videoFile.originalname,
        size: videoFile.size,
        mimeType: videoFile.mimetype
      };

      // Guardar los cambios
      await classItem.save();
      this.logger.log(`URL de video actualizada para la clase ${id}`);
      
      return classItem;
    } catch (error) {
      this.logger.error(`Error actualizando URL de video para clase ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 