import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Class } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { CoursesService } from '../courses/courses.service';
import { User, UserRole } from '../auth/schemas/user.schema';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(User.name) private userModel: Model<User>,
    private coursesService: CoursesService,
  ) {}

  async create(createClassDto: CreateClassDto, teacherId: string): Promise<Class> {
    this.logger.log(`Creando clase: ${JSON.stringify(createClassDto)} para profesor: ${teacherId}`);
    console.log(`Intentando crear clase con ID de profesor: ${teacherId} y ID de curso: ${createClassDto.courseId}`);
    
    // Validación adicional de campos
    if (!teacherId) {
      this.logger.error('Error al crear clase: ID de profesor no proporcionado');
      throw new BadRequestException('ID de profesor requerido');
    }
    
    if (!this.isValidYoutubeUrl(createClassDto.videoUrl)) {
      this.logger.warn(`URL de video no válida: ${createClassDto.videoUrl}`);
      throw new BadRequestException('La URL proporcionada no es una URL de YouTube válida');
    }
    
    try {
      const course = await this.coursesService.findOne(createClassDto.courseId);
      
      if (!course) {
        throw new NotFoundException(`Course with ID ${createClassDto.courseId} not found`);
      }
      
      // Extraer ID del profesor del curso de forma segura
      let teacherIdFromCourse = 'null';
      if (course.teacher) {
        if (typeof course.teacher === 'object' && course.teacher !== null) {
          // Si es un objeto (documento poblado), extraer el _id
          // Usamos 'as any' para evitar errores de typescript
          const teacherObj = course.teacher as any;
          teacherIdFromCourse = teacherObj._id ? 
            String(teacherObj._id) : 
            'objeto sin id';
        } else {
          // Si es una referencia directa (string/ObjectId)
          teacherIdFromCourse = String(course.teacher);
        }
      }
      
      const courseInfo = {
        id: String(course._id),
        title: course.title,
        teacherId: teacherIdFromCourse,
        requestingTeacherId: teacherId
      };
      
      console.log('Curso encontrado:', courseInfo);
      console.log('Tipo de course.teacher:', typeof course.teacher);
      
      if (typeof course.teacher === 'object' && course.teacher !== null) {
        console.log('Propiedades de course.teacher:', Object.keys(course.teacher));
        const teacherObj = course.teacher as any;
        if (teacherObj._id) {
          console.log('course.teacher._id:', teacherObj._id);
        }
      }
      
      this.logger.debug(`Verificando permisos para el curso ${createClassDto.courseId} - profesor solicitante: ${teacherId}`);
      
      // Convertimos IDs a string para comparación segura
      let courseTeacherId = '';
      
      if (course.teacher) {
        if (typeof course.teacher === 'object' && course.teacher !== null) {
          // Si es un objeto poblado, extraemos su _id como string
          const teacherObj = course.teacher as any;
          if (teacherObj._id) {
            courseTeacherId = String(teacherObj._id);
          }
        } else {
          // Si es directamente un ObjectId o string
          courseTeacherId = String(course.teacher);
        }
      }
      
      const requestingTeacherId = String(teacherId);
      
      console.log(`Comparando courseTeacherId=${courseTeacherId} con requestingTeacherId=${requestingTeacherId}`);
      
      // Verificar si el profesor es el dueño del curso
      const isTeacherOwner = courseTeacherId === requestingTeacherId;
      
      // Verificar si es administrador del sistema
      const teacher = await this.userModel.findById(teacherId);
      const isSystemAdmin = teacher && teacher.role === UserRole.ADMIN;
      
      console.log('Verificando permisos - datos de comparación:', {
        courseTeacherId,
        requestingTeacherId,
        isTeacherOwner,
        isSystemAdmin,
        teacherRole: teacher ? teacher.role : 'usuario no encontrado'
      });
      
      // Si el profesor no es el dueño del curso ni es administrador, denegar el acceso
      if (!isTeacherOwner && !isSystemAdmin) {
        console.log(`ACCESO DENEGADO: Usuario ${teacherId} no es el profesor del curso ${createClassDto.courseId}`);
        this.logger.warn(`Acceso denegado: Usuario ${teacherId} no es el profesor del curso ${createClassDto.courseId}`);
        throw new UnauthorizedException('You are not authorized to add classes to this course');
      }
      
      console.log(`ACCESO CONCEDIDO: Usuario ${teacherId} tiene permisos en el curso como ${
        isTeacherOwner ? 'profesor del curso' : 
        isSystemAdmin ? 'administrador del sistema' : 'desconocido'
      }`);
      
      const createdClass = new this.classModel({
        ...createClassDto,
        course: createClassDto.courseId,
        teacher: teacherId,
      });
      
      console.log('Datos de la clase a guardar:', JSON.stringify(createdClass));
      
      const result = await createdClass.save();
      
      console.log('Clase guardada exitosamente:', JSON.stringify(result));
      
      // Añadir la clase al curso
      await this.coursesService.addClass(createClassDto.courseId, String(result._id));
      
      this.logger.log(`Clase guardada exitosamente con ID: ${result._id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error creating class: ${error.message}`, error.stack);
      console.error('Stack error completo:', error.stack);
      
      if (error.name === 'ValidationError') {
        this.logger.warn(`Error de validación: ${JSON.stringify(error.errors)}`);
        throw new BadRequestException(`Error de validación: ${this.formatMongooseErrors(error)}`);
      }
      
      throw error;
    }
  }

  // Función auxiliar para validar URLs de YouTube
  private isValidYoutubeUrl(url: string): boolean {
    if (!url) return false;
    
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      
      // Verificar dominios de YouTube
      const youtubeHosts = [
        'youtube.com',
        'www.youtube.com',
        'youtu.be',
        'www.youtu.be'
      ];
      
      return youtubeHosts.some(host => hostname.endsWith(host));
    } catch (e) {
      return false;
    }
  }
  
  // Función para formatear errores de Mongoose
  private formatMongooseErrors(error: any): string {
    if (!error.errors) return error.message;
    
    return Object.keys(error.errors)
      .map(key => error.errors[key].message)
      .join('; ');
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
      
      this.logger.log(`Se encontraron ${classes.length} clases`);
      return classes;
    } catch (error) {
      this.logger.error(`Error al buscar clases: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: string) {
    this.logger.log(`Buscando clase con ID: ${id}`);
    try {
      const classItem = await this.classModel.findById(id)
        .populate('teacher', 'name email')
        .populate('course', 'title');
      
      if (!classItem) {
        this.logger.warn(`Clase con ID ${id} no encontrada`);
        throw new NotFoundException(`Clase con ID ${id} no encontrada`);
      }
      
      this.logger.log(`Clase encontrada: ${classItem.title}`);
      return classItem;
    } catch (error) {
      this.logger.error(`Error al buscar clase ${id}: ${error.message}`, error.stack);
      throw error;
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
      
      // Si se está actualizando la URL del video, validarla
      if (updateClassDto.videoUrl && !this.isValidYoutubeUrl(updateClassDto.videoUrl)) {
        throw new BadRequestException('La URL proporcionada no es una URL de YouTube válida');
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
      
      await this.classModel.findByIdAndDelete(id);
      
      this.logger.log(`Clase eliminada exitosamente: ${id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al eliminar clase ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 