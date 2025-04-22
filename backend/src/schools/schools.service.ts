import { Injectable, NotFoundException, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School } from './schemas/school.schema';
import { CreateSchoolDto } from './dto/create-school.dto';
import { User, UserRole } from '../auth/schemas/user.schema';

@Injectable()
export class SchoolsService {
  private readonly logger = new Logger(SchoolsService.name);

  constructor(
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async create(createSchoolDto: CreateSchoolDto, adminId: string) {
    this.logger.log(`Creando escuela: ${JSON.stringify(createSchoolDto)} para usuario: ${adminId}`);
    console.log(`Creando escuela con admin: ${adminId}`, createSchoolDto);
    
    try {
      // Verificar si el usuario existe
      const user = await this.userModel.findById(adminId);
      if (!user) {
        this.logger.error(`Usuario con ID ${adminId} no encontrado`);
        throw new NotFoundException('Usuario no encontrado');
      }
      
      // Verificar que el usuario tenga rol de admin o profesor
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.TEACHER) {
        this.logger.warn(`Usuario ${adminId} con rol ${user.role} no autorizado para crear escuelas`);
        throw new BadRequestException('Solo los administradores y profesores pueden crear escuelas');
      }
      
      this.logger.log(`Usuario validado con rol: ${user.role}`);
      console.log(`Usuario validado: ${user.name} (${user.email}) con rol: ${user.role}`);
      
      // Preparar la nueva escuela
      const newSchool = {
        ...createSchoolDto,
        admin: adminId,
        teachers: [] // Inicializar el array de profesores
      };
      
      // Si es profesor, también agregarlo como profesor de la escuela
      if (user.role === UserRole.TEACHER) {
        newSchool.teachers.push(adminId);
      }
      
      console.log('Datos de la nueva escuela antes de guardar:', {
        ...newSchool,
        admin: adminId.toString(),
        teachers: newSchool.teachers.map(t => t.toString())
      });
      
      const createdSchool = new this.schoolModel(newSchool);
      this.logger.debug(`Datos de la escuela a guardar: ${JSON.stringify(createdSchool)}`);
      
      const result = await createdSchool.save();
      console.log('Escuela guardada:', {
        id: result._id.toString(),
        name: result.name,
        admin: result.admin.toString(),
        teachers: result.teachers.map(t => t.toString())
      });
      
      // Actualizar el usuario con la referencia a la escuela
      const updateResult = await this.userModel.findByIdAndUpdate(adminId, {
        $addToSet: { schools: result._id }
      }, { new: true });
      
      console.log(`Usuario actualizado con la nueva escuela:`, {
        userId: updateResult._id.toString(),
        schools: updateResult.schools.map(s => s.toString())
      });
      
      // Verificar que la escuela se haya asignado correctamente al usuario
      const userHasSchool = updateResult.schools.some(s => 
        s.toString() === result._id.toString()
      );
      
      if (!userHasSchool) {
        this.logger.warn(`¡Advertencia! La escuela ${result._id} no se agregó correctamente al usuario ${adminId}`);
      }
      
      this.logger.log(`Escuela guardada exitosamente con ID: ${result._id}`);
      return result;
    } catch (error) {
      console.error('Error al guardar escuela:', error);
      this.logger.error(`Error al guardar escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(userId?: string, role?: UserRole) {
    this.logger.log('Buscando todas las escuelas');
    try {
      let query = {};
      
      // Si es un usuario no admin, filtramos por escuelas públicas o donde esté asociado
      if (userId && role !== UserRole.ADMIN) {
        if (role === UserRole.TEACHER) {
          query = { 
            $or: [
              { isPublic: true },
              { teachers: userId },
              { admin: userId }
            ] 
          };
        } else {
          query = { 
            $or: [
              { isPublic: true },
              { students: userId }
            ] 
          };
        }
      }
      
      const schools = await this.schoolModel.find(query)
        .populate('admin', 'name email')
        .select('-teachers -students');
      
      this.logger.log(`Se encontraron ${schools.length} escuelas`);
      return schools;
    } catch (error) {
      this.logger.error(`Error al buscar escuelas: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: string) {
    this.logger.log(`Buscando escuela con ID: ${id}`);
    try {
      const school = await this.schoolModel.findById(id)
        .populate('admin', 'name email')
        .populate('teachers', 'name email')
        .populate('students', 'name email');
      
      if (!school) {
        this.logger.warn(`Escuela con ID ${id} no encontrada`);
        throw new NotFoundException(`Escuela con ID ${id} no encontrada`);
      }
      
      this.logger.log(`Escuela encontrada: ${school.name}`);
      return school;
    } catch (error) {
      this.logger.error(`Error al buscar escuela ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: string, updateSchoolDto: any, userId: string) {
    this.logger.log(`Actualizando escuela con ID: ${id}`);
    try {
      const school = await this.schoolModel.findById(id);
      
      if (!school) {
        this.logger.warn(`Escuela con ID ${id} no encontrada`);
        throw new NotFoundException(`Escuela con ID ${id} no encontrada`);
      }
      
      // Verificar permisos
      if (school.admin.toString() !== userId) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para actualizar esta escuela');
        }
      }
      
      const updatedSchool = await this.schoolModel.findByIdAndUpdate(
        id,
        updateSchoolDto,
        { new: true }
      );
      
      this.logger.log(`Escuela actualizada exitosamente: ${updatedSchool._id}`);
      return updatedSchool;
    } catch (error) {
      this.logger.error(`Error al actualizar escuela ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addTeacher(schoolId: string, teacherId: string, adminId: string) {
    this.logger.log(`Añadiendo profesor ${teacherId} a escuela ${schoolId}`);
    try {
      const school = await this.schoolModel.findById(schoolId);
      
      if (!school) {
        this.logger.error(`Escuela con ID ${schoolId} no encontrada`);
        throw new NotFoundException('Escuela no encontrada');
      }
      
      // Verificar permisos
      const schoolAdminId = school.admin ? school.admin.toString() : '';
      if (schoolAdminId !== adminId) {
        const user = await this.userModel.findById(adminId);
        if (!user || user.role !== UserRole.ADMIN) {
          this.logger.warn(`Usuario ${adminId} sin permiso para modificar escuela ${schoolId}`);
          throw new BadRequestException('No tiene permisos para modificar esta escuela');
        }
      }
      
      // Verificar que el profesor exista y tenga rol de profesor
      const teacher = await this.userModel.findById(teacherId);
      if (!teacher) {
        this.logger.error(`Profesor con ID ${teacherId} no encontrado`);
        throw new NotFoundException('Profesor no encontrado');
      }
      
      if (teacher.role !== UserRole.TEACHER) {
        this.logger.warn(`Usuario ${teacherId} no tiene rol de profesor (rol actual: ${teacher.role})`);
        throw new BadRequestException('El usuario debe tener rol de profesor');
      }
      
      // Asegurar que el arreglo de profesores exista
      if (!school.teachers) {
        school.teachers = [];
      }
      
      // Verificar si el profesor ya está en la escuela
      const teacherIdStr = teacherId.toString();
      const isTeacherInSchool = school.teachers.some(t => 
        t && t.toString() === teacherIdStr
      );
      
      if (isTeacherInSchool) {
        this.logger.log(`El profesor ${teacherId} ya pertenece a la escuela ${schoolId}`);
        return { success: true, message: 'El profesor ya pertenece a esta escuela' };
      }
      
      console.log(`Añadiendo profesor ${teacherId} a escuela ${schoolId}, profesores actuales:`, 
        school.teachers ? school.teachers.map(t => t ? t.toString() : 'null') : 'ninguno');
      
      // Actualizar la escuela
      await this.schoolModel.findByIdAndUpdate(schoolId, {
        $addToSet: { teachers: teacherId }
      });
      
      // Actualizar el profesor
      await this.userModel.findByIdAndUpdate(teacherId, {
        $addToSet: { schools: schoolId }
      });
      
      this.logger.log(`Profesor ${teacherId} añadido exitosamente a escuela ${schoolId}`);
      
      // Verificar que la actualización se haya hecho correctamente
      const updatedSchool = await this.schoolModel.findById(schoolId);
      const isTeacherAddedToSchool = updatedSchool.teachers.some(t => 
        t && t.toString() === teacherIdStr
      );
      
      if (!isTeacherAddedToSchool) {
        this.logger.warn(`¡Advertencia! El profesor ${teacherId} no se añadió correctamente a la escuela ${schoolId}`);
      }
      
      const updatedTeacher = await this.userModel.findById(teacherId);
      const isSchoolAddedToTeacher = updatedTeacher.schools.some(s => 
        s && s.toString() === schoolId
      );
      
      if (!isSchoolAddedToTeacher) {
        this.logger.warn(`¡Advertencia! La escuela ${schoolId} no se añadió correctamente al profesor ${teacherId}`);
      }
      
      return { 
        success: true,
        teacherInSchool: isTeacherAddedToSchool,
        schoolInTeacher: isSchoolAddedToTeacher
      };
    } catch (error) {
      this.logger.error(`Error al añadir profesor: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addStudent(schoolId: string, studentId: string, userId: string) {
    this.logger.log(`Añadiendo estudiante ${studentId} a escuela ${schoolId}`);
    try {
      const school = await this.schoolModel.findById(schoolId);
      
      if (!school) {
        throw new NotFoundException('Escuela no encontrada');
      }
      
      // Verificar permisos (admin o profesor de la escuela)
      const isAdmin = school.admin.toString() === userId;
      const isTeacher = school.teachers.some(t => t.toString() === userId);
      
      if (!isAdmin && !isTeacher) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para modificar esta escuela');
        }
      }
      
      // Verificar que el estudiante exista
      const student = await this.userModel.findById(studentId);
      if (!student) {
        throw new NotFoundException('Estudiante no encontrado');
      }
      
      // Actualizar la escuela
      await this.schoolModel.findByIdAndUpdate(schoolId, {
        $addToSet: { students: studentId }
      });
      
      // Actualizar el estudiante
      await this.userModel.findByIdAndUpdate(studentId, {
        $addToSet: { schools: schoolId }
      });
      
      this.logger.log(`Estudiante ${studentId} añadido exitosamente a escuela ${schoolId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al añadir estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeTeacher(schoolId: string, teacherId: string, userId: string) {
    this.logger.log(`Eliminando profesor ${teacherId} de escuela ${schoolId}`);
    try {
      const school = await this.schoolModel.findById(schoolId);
      
      if (!school) {
        throw new NotFoundException('Escuela no encontrada');
      }
      
      // Verificar permisos
      if (school.admin.toString() !== userId) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para modificar esta escuela');
        }
      }
      
      // Actualizar la escuela
      await this.schoolModel.findByIdAndUpdate(schoolId, {
        $pull: { teachers: teacherId }
      });
      
      // Actualizar el profesor
      await this.userModel.findByIdAndUpdate(teacherId, {
        $pull: { schools: schoolId }
      });
      
      this.logger.log(`Profesor ${teacherId} eliminado exitosamente de escuela ${schoolId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al eliminar profesor: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeStudent(schoolId: string, studentId: string, userId: string) {
    this.logger.log(`Eliminando estudiante ${studentId} de escuela ${schoolId}`);
    try {
      const school = await this.schoolModel.findById(schoolId);
      
      if (!school) {
        throw new NotFoundException('Escuela no encontrada');
      }
      
      // Verificar permisos (admin o profesor de la escuela)
      const isAdmin = school.admin.toString() === userId;
      const isTeacher = school.teachers.some(t => t.toString() === userId);
      
      if (!isAdmin && !isTeacher) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          throw new BadRequestException('No tiene permisos para modificar esta escuela');
        }
      }
      
      // Actualizar la escuela
      await this.schoolModel.findByIdAndUpdate(schoolId, {
        $pull: { students: studentId }
      });
      
      // Actualizar el estudiante
      await this.userModel.findByIdAndUpdate(studentId, {
        $pull: { schools: schoolId }
      });
      
      this.logger.log(`Estudiante ${studentId} eliminado exitosamente de escuela ${schoolId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al eliminar estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addCourse(schoolId: string, courseId: string): Promise<School> {
    this.logger.log(`Añadiendo curso ${courseId} a escuela ${schoolId}`);
    
    try {
      const school = await this.schoolModel.findById(schoolId);
      
      if (!school) {
        this.logger.warn(`Escuela con ID ${schoolId} no encontrada`);
        throw new NotFoundException(`Escuela con ID ${schoolId} no encontrada`);
      }

      // Si la escuela no tiene un array de cursos, inicializarlo
      if (!school.courses) {
        this.logger.debug(`Inicializando array de cursos para escuela ${schoolId}`);
        school.courses = [];
      }
      
      // Verificar si el curso ya está en la escuela
      const courseExists = school.courses.some(c => c.toString() === courseId);
      
      if (courseExists) {
        this.logger.debug(`El curso ${courseId} ya existe en la escuela ${schoolId}`);
        return school;
      }
      
      const result = await this.schoolModel.findByIdAndUpdate(
        schoolId,
        { $addToSet: { courses: courseId } },
        { new: true }
      );
      
      if (!result) {
        throw new NotFoundException(`No se pudo actualizar la escuela con ID ${schoolId}`);
      }
      
      this.logger.log(`Curso ${courseId} añadido exitosamente a escuela ${schoolId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al añadir curso a escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeCourse(schoolId: string, courseId: string): Promise<School> {
    this.logger.log(`Eliminando curso ${courseId} de escuela ${schoolId}`);
    
    try {
      const school = await this.schoolModel.findById(schoolId);
      
      if (!school) {
        this.logger.warn(`Escuela con ID ${schoolId} no encontrada`);
        throw new NotFoundException(`Escuela con ID ${schoolId} no encontrada`);
      }

      if (!school.courses || !school.courses.some(c => c.toString() === courseId)) {
        this.logger.debug(`El curso ${courseId} no existe en la escuela ${schoolId}`);
        return school;
      }
      
      const result = await this.schoolModel.findByIdAndUpdate(
        schoolId,
        { $pull: { courses: courseId } },
        { new: true }
      );
      
      if (!result) {
        throw new NotFoundException(`No se pudo actualizar la escuela con ID ${schoolId}`);
      }
      
      this.logger.log(`Curso ${courseId} eliminado exitosamente de escuela ${schoolId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al eliminar curso de escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    this.logger.log(`Eliminando escuela con ID: ${id}`);
    try {
      const school = await this.schoolModel.findById(id);
      
      if (!school) {
        this.logger.warn(`Escuela con ID ${id} no encontrada`);
        throw new NotFoundException(`Escuela con ID ${id} no encontrada`);
      }
      
      // Verificar permisos (admin de la escuela o admin del sistema)
      const isSchoolAdmin = school.admin.toString() === userId;
      
      if (!isSchoolAdmin) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          this.logger.warn(`Usuario ${userId} no tiene permisos para eliminar la escuela ${id}`);
          throw new UnauthorizedException('No tiene permisos para eliminar esta escuela');
        }
      }
      
      // Remover las referencias a la escuela de todos los usuarios (admin, profesores, estudiantes)
      const adminId = school.admin.toString();
      await this.userModel.findByIdAndUpdate(adminId, {
        $pull: { schools: id }
      });
      
      // Remover la escuela de los profesores
      if (school.teachers && school.teachers.length > 0) {
        await this.userModel.updateMany(
          { _id: { $in: school.teachers } },
          { $pull: { schools: id } }
        );
      }
      
      // Remover la escuela de los estudiantes
      if (school.students && school.students.length > 0) {
        await this.userModel.updateMany(
          { _id: { $in: school.students } },
          { $pull: { schools: id } }
        );
      }
      
      // Eliminar la escuela
      await this.schoolModel.findByIdAndDelete(id);
      
      this.logger.log(`Escuela eliminada exitosamente: ${id}`);
      return { success: true, message: 'Escuela eliminada exitosamente' };
    } catch (error) {
      this.logger.error(`Error al eliminar escuela ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}