import { Injectable, NotFoundException, BadRequestException, Logger, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

  async create(createSchoolDto: CreateSchoolDto, userId: string) {
    const { name, description, logoUrl, isPublic, admin, teachers, administratives, sedes } = createSchoolDto;
    
    try {
      // Validate user permissions for creating schools
      
      // Create the school
      const school = new this.schoolModel({
        name,
        description,
        logoUrl,
        isPublic,
        admin: admin || userId,
        sedes: sedes || [],
      });
      
      // Add teachers if provided
      if (teachers && teachers.length > 0) {
        // Instead of setting the entire array, use the $addToSet operation in the update
        const teacherIds = teachers.map(id => id);
        
        // Update each teacher to include this school in their schools array
        for (const teacherId of teacherIds) {
          await this.userModel.findByIdAndUpdate(
            teacherId,
            { $addToSet: { schools: school._id } }
          );
        }
        
        // Use $addToSet in the final update to add the teachers
        await this.schoolModel.findByIdAndUpdate(
          school._id,
          { $addToSet: { teachers: { $each: teacherIds } } }
        );
      }
      
      // Add administratives if provided
      if (administratives && administratives.length > 0) {
        // Instead of setting the entire array, use the $addToSet operation in the update
        const adminIds = administratives.map(id => id);
        
        // Update each administrative to include this school in their schools array
        for (const adminId of adminIds) {
          await this.userModel.findByIdAndUpdate(
            adminId,
            { $addToSet: { schools: school._id, administratedSchools: school._id } }
          );
        }
        
        // Use $addToSet in the final update to add the administratives
        await this.schoolModel.findByIdAndUpdate(
          school._id,
          { $addToSet: { administratives: { $each: adminIds } } }
        );
      }
      
      // Save the school
      const result = await this.schoolModel.findById(school._id);
      
      // Update the owner's (admin) document to include this school
      await this.userModel.findByIdAndUpdate(
        admin || userId,
        { 
          $addToSet: { 
            schools: result._id,
            ownedSchools: result._id 
          } 
        }
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Error al crear escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(userId?: string, role?: UserRole) {
    
    try {
      let query = {};
      
      // Si es un usuario no admin, filtramos por escuelas públicas o donde esté asociado
      if (userId && role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
        // Necesitamos asegurarnos de que userId sea un string válido
        const safeUserId = userId.toString();
        
        if (role === UserRole.TEACHER) {
          query = { 
            $or: [
              { isPublic: true },
              { teachers: safeUserId },
              { admin: safeUserId }
            ] 
          };
        } else {
          query = { 
            $or: [
              { isPublic: true },
              { students: safeUserId }
            ] 
          };
        }
      }
      
      const schools = await this.schoolModel.find(query)
        .populate('admin', 'name email')
        .select('-teachers -students');
      
      
      return schools;
    } catch (error) {
      this.logger.error(`Error al buscar escuelas: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: string) {
    
    try {
      // Verifica si el ID es válido para MongoDB
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        
        throw new BadRequestException(`ID de escuela inválido: ${id}`);
      }

      const school = await this.schoolModel.findById(id)
        .populate('admin', 'name email')
        .populate('teachers', 'name email')
        .populate('students', 'name email')
        .catch(err => {
          this.logger.error(`Error en la consulta de base de datos: ${err.message}`);
          throw new InternalServerErrorException('Error al acceder a la base de datos');
        });
      
      if (!school) {
        
        throw new NotFoundException(`Escuela con ID ${id} no encontrada`);
      }
      
      
      return school;
    } catch (error) {
      this.logger.error(`Error al buscar escuela ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: string, updateSchoolDto: any, userId: string) {
    
    try {
      const school = await this.schoolModel.findById(id);
      
      if (!school) {
        
        throw new NotFoundException(`Escuela con ID ${id} no encontrada`);
      }
      
      
      
      // Verificar permisos
      const schoolAdminId = school.admin.toString();
      
      
      if (schoolAdminId !== userId) {
        
        const user = await this.userModel.findById(userId);
        if (!user) {
          
          throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
        }
        
        
        
        if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SCHOOL_OWNER && user.role !== UserRole.ADMIN) {
          
          throw new BadRequestException('No tiene permisos para actualizar esta escuela');
        }
        
        // Si es SCHOOL_OWNER, verificar que sea dueño de esta escuela
        if (user.role === UserRole.SCHOOL_OWNER) {
          const isOwner = user.ownedSchools.some(schoolId => schoolId.toString() === id);
          
          
          if (!isOwner) {
            
            throw new BadRequestException('No es dueño de esta escuela');
          }
        }
        
        // Si es ADMIN, verificar si tiene la escuela en administratedSchools
        if (user.role === UserRole.ADMIN) {
          
          const isAdmin = user.administratedSchools.some(schoolId => schoolId.toString() === id);
          
          if (!isAdmin) {
            
            // Aunque podríamos lanzar una excepción aquí, permitimos que los admins puedan editar cualquier escuela
          }
        }
      } else {
        
      }
      
      
      const updatedSchool = await this.schoolModel.findByIdAndUpdate(
        id,
        updateSchoolDto,
        { new: true }
      );
      
      
      return updatedSchool;
    } catch (error) {
      this.logger.error(`Error al actualizar escuela ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addTeacher(schoolId: string, teacherId: string, adminId: string) {
    
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
        
        return { success: true, message: 'El profesor ya pertenece a esta escuela' };
      }
      
      // Actualizar la escuela
      await this.schoolModel.findByIdAndUpdate(schoolId, {
        $addToSet: { teachers: teacherId }
      });
      
      // Actualizar el profesor
      await this.userModel.findByIdAndUpdate(teacherId, {
        $addToSet: { schools: schoolId }
      });
      
      
      
      // Verificar que la actualización se haya hecho correctamente
      const updatedSchool = await this.schoolModel.findById(schoolId);
      const isTeacherAddedToSchool = updatedSchool.teachers.some(t => 
        t && t.toString() === teacherIdStr
      );
      
      if (!isTeacherAddedToSchool) {
        
      }
      
      const updatedTeacher = await this.userModel.findById(teacherId);
      const isSchoolAddedToTeacher = updatedTeacher.schools.some(s => 
        s && s.toString() === schoolId
      );
      
      if (!isSchoolAddedToTeacher) {
        
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
      
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al añadir estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeTeacher(schoolId: string, teacherId: string, userId: string) {
    
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
      
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al eliminar profesor: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeStudent(schoolId: string, studentId: string, userId: string) {
    
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
      
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al eliminar estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addCourse(schoolId: string, courseId: string): Promise<School> {
    
    
    try {
      const school = await this.schoolModel.findById(schoolId);
      
      if (!school) {
        
        throw new NotFoundException(`Escuela con ID ${schoolId} no encontrada`);
      }

      // Si la escuela no tiene un array de cursos, inicializarlo
      if (!school.courses) {
        
        school.courses = [];
      }
      
      // Verificar si el curso ya está en la escuela
      const courseExists = school.courses.some(c => c.toString() === courseId);
      
      if (courseExists) {
        
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
      
      
      return result;
    } catch (error) {
      this.logger.error(`Error al añadir curso a escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeCourse(schoolId: string, courseId: string): Promise<School> {
    
    
    try {
      const school = await this.schoolModel.findById(schoolId);
      
      if (!school) {
        
        throw new NotFoundException(`Escuela con ID ${schoolId} no encontrada`);
      }

      if (!school.courses || !school.courses.some(c => c.toString() === courseId)) {
        
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
      
      
      return result;
    } catch (error) {
      this.logger.error(`Error al eliminar curso de escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    
    try {
      const school = await this.schoolModel.findById(id);
      
      if (!school) {
        
        throw new NotFoundException(`Escuela con ID ${id} no encontrada`);
      }
      
      // Verificar permisos (admin de la escuela o admin del sistema)
      const isSchoolAdmin = school.admin.toString() === userId;
      
      if (!isSchoolAdmin) {
        const user = await this.userModel.findById(userId);
        if (!user || user.role !== UserRole.ADMIN) {
          
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
      
      
      return { success: true, message: 'Escuela eliminada exitosamente' };
    } catch (error) {
      this.logger.error(`Error al eliminar escuela ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async assignOwner(schoolId: string, userId: string) {
    
    
    try {
      // Check if school exists
      const school = await this.schoolModel.findById(schoolId);
      if (!school) {
        throw new NotFoundException(`School with ID ${schoolId} not found`);
      }
      
      // Check if user exists
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }
      
      // Assign user as the school owner
      // Update user's role to SCHOOL_OWNER if not already an admin or higher
      if (user.role === UserRole.TEACHER || user.role === UserRole.STUDENT) {
        await this.userModel.findByIdAndUpdate(userId, {
          role: UserRole.SCHOOL_OWNER,
          $addToSet: { 
            schools: schoolId,
            ownedSchools: schoolId 
          }
        });
      } else {
        // Just add the school to their owned schools
        await this.userModel.findByIdAndUpdate(userId, {
          $addToSet: { 
            schools: schoolId,
            ownedSchools: schoolId 
          }
        });
      }
      
      // Update the school
      const updatedSchool = await this.schoolModel.findByIdAndUpdate(
        schoolId,
        { admin: userId },
        { new: true }
      ).populate('admin', 'name email');
      
      return updatedSchool;
    } catch (error) {
      this.logger.error(`Error assigning school owner: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Método para encontrar escuelas por propietario
  async findSchoolsByOwner(userId: string): Promise<School[]> {
    try {
      return this.schoolModel.find({ admin: userId }).exec();
    } catch (error) {
      this.logger.error(`Error al buscar escuelas por propietario: ${error.message}`);
      throw new Error('Error al buscar escuelas por propietario');
    }
  }

  // Método para encontrar escuelas por administrador
  async findSchoolsByAdministrator(userId: string): Promise<School[]> {
    return this.schoolModel.find({ administratives: userId })
      .populate('admin', 'name email')
      .select('-teachers -students');
  }

  /**
   * Encuentra profesores por sus IDs
   * @param teacherIds Array de IDs de profesores
   * @returns Array de profesores con sus datos
   */
  async findTeachersByIds(teacherIds: any[]): Promise<any[]> {
    try {
      // Asegurarse de que todos los IDs sean válidos
      const validIds = teacherIds.filter(id => id && String(id).match(/^[0-9a-fA-F]{24}$/));
      
      if (validIds.length === 0) {
        return [];
      }
      
      // Convertir los IDs a ObjectId si es necesario
      const objectIds = validIds.map(id => 
        id instanceof Types.ObjectId ? id : new Types.ObjectId(String(id))
      );

      // Buscar profesores con los roles adecuados (teacher, admin, super_admin)
      const teachers = await this.userModel.find({
        _id: { $in: objectIds },
        role: { $in: [UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER] }
      })
      .select('name email role')
      .lean();
      
      return teachers;
    } catch (error) {
      this.logger.error(`Error al buscar profesores por IDs: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Encuentra todos los profesores asociados a una escuela
   * @param schoolId ID de la escuela
   * @returns Array de profesores con sus datos
   */
  async findAllTeachersBySchool(schoolId: string): Promise<any[]> {
    try {
      // Verificar formato del ID
      if (!schoolId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new BadRequestException(`ID de escuela inválido: ${schoolId}`);
      }
      
      // Obtener la escuela
      const school = await this.schoolModel.findById(schoolId);
      if (!school) {
        throw new NotFoundException(`Escuela con ID ${schoolId} no encontrada`);
      }
      
      // Extraer los IDs de profesores asignados a la escuela
      const teacherIds = school.teachers.map(teacher => 
        typeof teacher === 'object' && teacher !== null ? (teacher as any)._id : teacher
      );
      
      // Agregar el admin de la escuela a la lista
      const adminId = typeof school.admin === 'object' && school.admin !== null 
        ? (school.admin as any)._id 
        : school.admin;
      
      if (adminId) {
        teacherIds.push(adminId);
      }
      
      // Buscar school_owners que tengan esta escuela
      const schoolOwners = await this.userModel.find({
        role: UserRole.SCHOOL_OWNER,
        ownedSchools: schoolId
      })
      .select('_id')
      .lean();
      
      const schoolOwnerIds = schoolOwners.map(owner => owner._id);
      teacherIds.push(...schoolOwnerIds);
      
      // Buscar administrativos de la escuela
      const administrativeIds = school.administratives || [];
      teacherIds.push(...administrativeIds);
      
      // Eliminar duplicados convirtiendo a Set y volviendo a array
      const uniqueTeacherIds = [...new Set(teacherIds.map(id => String(id)))];
      
      // Buscar todos los usuarios que pueden enseñar (todos los roles excepto estudiantes)
      const allTeachers = await this.userModel.find({
        $or: [
          { _id: { $in: uniqueTeacherIds } },
          { 
            role: { $in: [UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER] },
            schools: schoolId
          }
        ]
      })
      .select('name email role')
      .lean();
      
      return allTeachers;
    } catch (error) {
      this.logger.error(`Error al buscar profesores de la escuela: ${error.message}`, error.stack);
      return [];
    }
  }

  async findPublic() {
    try {
      const schools = await this.schoolModel.find({ isPublic: true })
        .populate('admin', 'name email')
        .select('-teachers -students');
      
      return schools;
    } catch (error) {
      this.logger.error(`Error al buscar escuelas públicas: ${error.message}`, error.stack);
      throw error;
    }
  }
}