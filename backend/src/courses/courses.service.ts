import { Injectable, NotFoundException, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course } from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { User, UserRole } from '../auth/schemas/user.schema';
import { SchoolsService } from '../schools/schools.service';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(User.name) private userModel: Model<User>,
    private schoolsService: SchoolsService,
  ) {}

  async create(createCourseDto: CreateCourseDto, teacherId: string): Promise<Course> {
    this.logger.log(`Creando curso: ${JSON.stringify(createCourseDto)} para profesor: ${teacherId}`);
    console.log(`Creando curso: ${JSON.stringify(createCourseDto)} para profesor: ${teacherId}`);
    
    try {
      // Verificar que el profesor exista
      const teacher = await this.userModel.findById(teacherId);
      if (!teacher) {
        this.logger.error(`Profesor con ID ${teacherId} no encontrado`);
        throw new NotFoundException(`Profesor con ID ${teacherId} no encontrado`);
      }
      
      this.logger.log(`Profesor encontrado: ${teacher.name} (${teacher.email}), rol: ${teacher.role}`);
      console.log(`Profesor encontrado: ID=${teacher._id}, nombre=${teacher.name}, rol=${teacher.role}`);
      
      // Verificar que la escuela exista
      const school = await this.schoolsService.findOne(createCourseDto.schoolId);
      
      if (!school) {
        this.logger.error(`Escuela con ID ${createCourseDto.schoolId} no encontrada`);
        throw new NotFoundException(`Escuela con ID ${createCourseDto.schoolId} no encontrada`);
      }
      
      // Para evitar errores de tipo, usar el operador de acceso seguro
      const adminId = school.admin ? 
        (typeof school.admin === 'object' && school.admin !== null ? String(school.admin) : String(school.admin)) : 
        'null';
        
      console.log('Escuela encontrada:', {
        id: String(school._id),
        name: school.name,
        admin: adminId,
        teachers: Array.isArray(school.teachers) ? 
          school.teachers.map(t => {
            if (!t) return 'null';
            return String(t);
          }) : 
          'no es un array',
      });
      
      // Convertir IDs a string para comparación segura
      const schoolAdminId = adminId !== 'null' ? adminId : '';
      const teacherIdStr = teacherId ? String(teacherId) : '';
      
      console.log(`Comparando teacherId=${teacherIdStr} con schoolAdminId=${schoolAdminId}`);
      console.log('Datos brutos de school.admin:', school.admin);
      
      // Verificar si el profesor pertenece a la escuela o es admin
      let isTeacherInSchool = false;
      
      // Depurar el contenido del array de profesores
      console.log('Contenido de school.teachers:', school.teachers);
      
      if (Array.isArray(school.teachers)) {
        isTeacherInSchool = school.teachers.some(t => {
          if (!t) return false;
          const teacherRefId = String(t);
          console.log(`Comparando profesor de escuela: ${teacherRefId} con ${teacherIdStr}, coincide: ${teacherRefId === teacherIdStr}`);
          return teacherRefId === teacherIdStr;
        });
      }
      
      const isAdmin = schoolAdminId === teacherIdStr;
      
      // Verificar también si es administrador de sistema
      const isSystemAdmin = teacher.role === UserRole.ADMIN;
      
      // Verificar las escuelas asignadas al profesor
      const teacherSchools = Array.isArray(teacher.schools) ? 
        teacher.schools.map(s => String(s)) : 
        [];
        
      const isSchoolInTeacherSchools = teacherSchools.includes(String(createCourseDto.schoolId));
      
      console.log('Verificando permisos - datos de comparación:', {
        teacherId: teacherIdStr,
        schoolAdminId: schoolAdminId,
        isAdmin,
        isTeacherInSchool,
        isSystemAdmin,
        userRole: teacher.role,
        teacherSchools,
        isSchoolInTeacherSchools
      });
      
      this.logger.debug(`Verificando permisos: isAdmin=${isAdmin}, isTeacherInSchool=${isTeacherInSchool}, isSystemAdmin=${isSystemAdmin}, isSchoolInTeacherSchools=${isSchoolInTeacherSchools}`);
      
      // Si el usuario creó la escuela (es admin) o es profesor de la escuela o es admin del sistema o la escuela está en sus escuelas, permitir la creación
      if (!isTeacherInSchool && !isAdmin && !isSystemAdmin && !isSchoolInTeacherSchools) {
        console.log(`ACCESO DENEGADO: Usuario ${teacherId} no tiene permisos en la escuela ${createCourseDto.schoolId}`);
        this.logger.warn(`Acceso denegado: Usuario ${teacherId} no tiene permisos en la escuela ${createCourseDto.schoolId}`);
        throw new UnauthorizedException('No tienes autorización para crear cursos en esta escuela');
      }
      
      console.log(`ACCESO CONCEDIDO: Usuario ${teacherId} tiene permisos en la escuela como ${
        isAdmin ? 'administrador de la escuela' : 
        isTeacherInSchool ? 'profesor de la escuela' : 
        isSystemAdmin ? 'administrador del sistema' :
        isSchoolInTeacherSchools ? 'profesor asignado a la escuela' : 'desconocido'
      }`);
      
      const createdCourse = new this.courseModel({
        title: createCourseDto.title,
        description: createCourseDto.description,
        coverImageUrl: createCourseDto.coverImageUrl || 'https://via.placeholder.com/300?text=Curso',
        isPublic: createCourseDto.isPublic !== undefined ? createCourseDto.isPublic : false,
        school: createCourseDto.schoolId,
        teacher: teacherId,
      });
      
      this.logger.debug(`Datos del curso a guardar: ${JSON.stringify(createdCourse)}`);
      
      const result = await createdCourse.save();
      console.log('Curso guardado exitosamente:', result);
      
      // Añadir el curso a la escuela
      this.logger.debug(`Añadiendo curso ${String(result._id)} a escuela ${createCourseDto.schoolId}`);
      try {
        await this.schoolsService.addCourse(createCourseDto.schoolId, String(result._id));
        console.log(`Curso añadido exitosamente a la escuela ${createCourseDto.schoolId}`);
      } catch (error) {
        this.logger.error(`Error al añadir curso a escuela: ${error.message}`, error.stack);
        console.error('Error al añadir curso a escuela:', error);
        // No lanzamos la excepción para evitar que falle la creación del curso
      }
      
      this.logger.log(`Curso guardado exitosamente con ID: ${result._id}`);
      return result;
    } catch (error) {
      console.error('Error al crear curso:', error);
      this.logger.error(`Error al crear curso: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(userId?: string, role?: UserRole, schoolId?: string) {
    this.logger.log(`Buscando todos los cursos${schoolId ? ` de la escuela ${schoolId}` : ''}`);
    try {
      let query: any = {};
      
      // Si se especifica una escuela, filtramos por ella
      if (schoolId) {
        query.school = schoolId;
      }
      
      // Si es un usuario no admin, filtramos por cursos públicos o donde esté asociado
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
            $or: [
              { isPublic: true },
              { students: userId }
            ] 
          };
        }
      }
      
      const courses = await this.courseModel.find(query)
        .populate('school', 'name')
        .populate('teacher', 'name email')
        .select('-students -classes');
      
      this.logger.log(`Se encontraron ${courses.length} cursos`);
      return courses;
    } catch (error) {
      this.logger.error(`Error al buscar cursos: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: string) {
    this.logger.log(`Buscando curso con ID: ${id}`);
    try {
      const course = await this.courseModel.findById(id)
        .populate('school', 'name')
        .populate('teacher', 'name email')
        .populate({
          path: 'classes',
          options: { sort: { order: 1 } }
        })
        .populate('students', 'name email');
      
      if (!course) {
        this.logger.warn(`Curso con ID ${id} no encontrado`);
        throw new NotFoundException(`Curso con ID ${id} no encontrado`);
      }
      
      this.logger.log(`Curso encontrado: ${course.title}`);
      return course;
    } catch (error) {
      this.logger.error(`Error al buscar curso ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: string, updateCourseDto: any, userId: string) {
    this.logger.log(`Actualizando curso con ID: ${id}`);
    try {
      const course = await this.courseModel.findById(id);
      
      if (!course) {
        this.logger.warn(`Curso con ID ${id} no encontrado`);
        throw new NotFoundException(`Curso con ID ${id} no encontrado`);
      }
      
      // Verificar permisos
      if (course.teacher.toString() !== userId) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para actualizar este curso');
        }
      }
      
      const updatedCourse = await this.courseModel.findByIdAndUpdate(
        id,
        updateCourseDto,
        { new: true }
      );
      
      this.logger.log(`Curso actualizado exitosamente: ${updatedCourse._id}`);
      return updatedCourse;
    } catch (error) {
      this.logger.error(`Error al actualizar curso ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addStudent(courseId: string, studentId: string, userId: string) {
    this.logger.log(`Añadiendo estudiante ${studentId} a curso ${courseId}`);
    try {
      const course = await this.courseModel.findById(courseId);
      
      if (!course) {
        throw new NotFoundException('Curso no encontrado');
      }
      
      // Verificar permisos (profesor del curso o admin)
      const isTeacher = course.teacher.toString() === userId;
      
      if (!isTeacher) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para modificar este curso');
        }
      }
      
      // Verificar que el estudiante exista
      const student = await this.userModel.findById(studentId);
      if (!student) {
        throw new NotFoundException('Estudiante no encontrado');
      }
      
      // Actualizar el curso
      await this.courseModel.findByIdAndUpdate(courseId, {
        $addToSet: { students: studentId }
      });
      
      // Actualizar el estudiante
      await this.userModel.findByIdAndUpdate(studentId, {
        $addToSet: { enrolledCourses: courseId }
      });
      
      this.logger.log(`Estudiante ${studentId} añadido exitosamente a curso ${courseId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al añadir estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeStudent(courseId: string, studentId: string, userId: string) {
    this.logger.log(`Eliminando estudiante ${studentId} de curso ${courseId}`);
    try {
      const course = await this.courseModel.findById(courseId);
      
      if (!course) {
        throw new NotFoundException('Curso no encontrado');
      }
      
      // Verificar permisos (profesor del curso o admin)
      const isTeacher = course.teacher.toString() === userId;
      
      if (!isTeacher) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para modificar este curso');
        }
      }
      
      // Actualizar el curso
      await this.courseModel.findByIdAndUpdate(courseId, {
        $pull: { students: studentId }
      });
      
      // Actualizar el estudiante
      await this.userModel.findByIdAndUpdate(studentId, {
        $pull: { enrolledCourses: courseId }
      });
      
      this.logger.log(`Estudiante ${studentId} eliminado exitosamente de curso ${courseId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al eliminar estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addClass(courseId: string, classId: string): Promise<Course> {
    const result = await this.courseModel.findByIdAndUpdate(
      courseId,
      { $addToSet: { classes: classId } },
      { new: true }
    );
    
    if (!result) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    
    return result;
  }

  async remove(id: string, userId: string) {
    this.logger.log(`Eliminando curso con ID: ${id}`);
    try {
      const course = await this.courseModel.findById(id);
      
      if (!course) {
        this.logger.warn(`Curso con ID ${id} no encontrado`);
        throw new NotFoundException(`Curso con ID ${id} no encontrado`);
      }
      
      // Verificar permisos (profesor del curso o admin)
      const isTeacher = course.teacher.toString() === userId;
      
      if (!isTeacher) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          this.logger.warn(`Usuario ${userId} no tiene permisos para eliminar el curso ${id}`);
          throw new UnauthorizedException('No tiene permisos para eliminar este curso');
        }
      }
      
      // Eliminar el curso
      await this.courseModel.findByIdAndDelete(id);
      
      // Eliminar la referencia del curso en la escuela
      try {
        const schoolId = course.school.toString();
        await this.schoolsService.removeCourse(schoolId, id);
      } catch (error) {
        this.logger.error(`Error al eliminar referencia del curso en la escuela: ${error.message}`, error.stack);
        // No lanzamos excepción para no interrumpir la eliminación del curso
      }
      
      this.logger.log(`Curso eliminado exitosamente: ${id}`);
      return { success: true, message: 'Curso eliminado exitosamente' };
    } catch (error) {
      this.logger.error(`Error al eliminar curso ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 