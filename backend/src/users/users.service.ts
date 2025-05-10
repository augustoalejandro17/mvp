import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import * as argon2 from 'argon2';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Course } from '../courses/schemas/course.schema';
import { School } from '../schools/schemas/school.schema';
import { Attendance as CourseAttendance } from '../attendance/schemas/attendance.schema';
import { Attendance as ClassAttendance } from '../classes/schemas/attendance.schema';

// DTOs para los nuevos métodos
class RegisterUnregisteredUserDto {
  email: string;
  password: string;
  additionalInfo?: {
    [key: string]: any;
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(CourseAttendance.name) private courseAttendanceModel: Model<CourseAttendance>,
    @InjectModel(ClassAttendance.name) private classAttendanceModel: Model<ClassAttendance>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email }).exec();
  }

  async create(userData: Partial<User>): Promise<User> {
    const createdUser = new this.userModel(userData);
    return createdUser.save();
  }

  async createWithCourses(userData: Partial<User>, courseIds: string[] = []): Promise<User> {
    
    
    // Crear usuario básico
    const createdUser = new this.userModel({
      ...userData,
      enrolledCourses: courseIds
    });
    
    // Guardar el usuario
    const savedUser = await createdUser.save();
    
    // Si hay cursos, actualizar la relación en los cursos también
    if (courseIds && courseIds.length > 0) {
      
      
      // Actualizar los cursos para incluir al estudiante
      await this.enrollUserInCourses(savedUser._id, courseIds);
    }
    
    return savedUser;
  }

  private async enrollUserInCourses(userId: string | Types.ObjectId, courseIds: string[]): Promise<void> {
    // Importar dynamically para evitar dependencias circulares
    const { Course } = await import('../courses/schemas/course.schema');
    const { model } = await import('mongoose');
    
    const CourseModel = model<typeof Course>(Course.name);
    
    // Asegurar que userId es un ObjectId
    const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    
    // Actualizar cada curso
    for (const courseId of courseIds) {
      await CourseModel.findByIdAndUpdate(
        courseId,
        { $addToSet: { students: userObjectId } },
        { new: true }
      );
    }
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(id, userData, { new: true }).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async remove(id: string): Promise<User> {
    

    try {
      // Find the user first to ensure it exists
      const user = await this.userModel.findById(id).exec();
      if (!user) {
        
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Remove user references from courses
      if (user.enrolledCourses && user.enrolledCourses.length > 0) {
        
        await this.courseModel.updateMany(
          { _id: { $in: user.enrolledCourses } },
          { $pull: { students: id } }
        );
      }

      if (user.teachingCourses && user.teachingCourses.length > 0) {
        
        // Note: Not automatically deleting courses - this would require business logic for teacher reassignment
      }

      // Remove user references from schools
      if (user.schools && user.schools.length > 0) {
        
        await this.schoolModel.updateMany(
          { _id: { $in: user.schools } },
          { $pull: { students: id, teachers: id } }
        );
      }

      if (user.administratedSchools && user.administratedSchools.length > 0) {
        
        // Note: Not automatically reassigning school admins - this would require business logic
      }

      // Clean up course attendance records
      // 1. Find course attendance records where this user is the student
      const studentCourseAttendanceCount = await this.courseAttendanceModel.countDocuments({ 
        student: id,
        studentModel: 'User'
      });
      
      if (studentCourseAttendanceCount > 0) {
        
        await this.courseAttendanceModel.deleteMany({ 
          student: id,
          studentModel: 'User'
        });
      }
      
      // 2. Find course attendance records where this user marked the attendance
      const markedCourseAttendanceCount = await this.courseAttendanceModel.countDocuments({ markedBy: id });
      if (markedCourseAttendanceCount > 0) {
        
        await this.courseAttendanceModel.updateMany(
          { markedBy: id },
          { $set: { markedBy: null } }
        );
      }

      // Clean up class attendance records
      // 1. Find class attendance records where this user is the student
      const studentClassAttendanceCount = await this.classAttendanceModel.countDocuments({ 
        student: id
      });
      
      if (studentClassAttendanceCount > 0) {
        
        await this.classAttendanceModel.deleteMany({ 
          student: id
        });
      }
      
      // 2. Find class attendance records where this user recorded the attendance
      const recordedClassAttendanceCount = await this.classAttendanceModel.countDocuments({ recordedBy: id });
      if (recordedClassAttendanceCount > 0) {
        
        await this.classAttendanceModel.updateMany(
          { recordedBy: id },
          { $set: { recordedBy: null } }
        );
      }

      // Delete the user
      const deletedUser = await this.userModel.findByIdAndDelete(id).exec();
      
      
      return deletedUser;
    } catch (error) {
      this.logger.error(`Error removing user ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async changeRole(userId: string, role: UserRole): Promise<User> {
    
    
    // Validar que el rol sea uno de los permitidos
    if (!Object.values(UserRole).includes(role)) {
      throw new BadRequestException('Invalid role');
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { role },
      { new: true },
    ).exec();
    
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    
    return user;
  }

  async findByRole(role: UserRole): Promise<User[]> {
    this.logger.log(`Buscando usuarios con rol: ${role}`);
    
    // Validar que el rol sea uno de los permitidos
    if (!Object.values(UserRole).includes(role)) {
      throw new BadRequestException('Invalid role');
    }
    
    return this.userModel.find({ role }).select('_id name email role').exec();
  }

  async findTeachersBySchool(schoolId: string): Promise<User[]> {
    this.logger.log(`Buscando profesores para la escuela: ${schoolId}`);
    
    // Verificar que la escuela exista
    const school = await this.schoolModel.findById(schoolId);
    if (!school) {
      throw new NotFoundException(`Escuela con ID ${schoolId} no encontrada`);
    }
    
    // Buscar usuarios que:
    // 1. Tengan rol global TEACHER y estén en la escuela, O
    // 2. Tengan un schoolRole de 'teacher' para esta escuela específica
    const teachers = await this.userModel.find({
      $and: [
        { schools: schoolId }, // Deben estar asociados a la escuela
        {
          $or: [
            { role: UserRole.TEACHER }, // Rol global es TEACHER
            { 'schoolRoles': { 
                $elemMatch: { 
                  'schoolId': new Types.ObjectId(schoolId), 
                  'role': 'teacher'
                } 
              }
            } // O tienen un rol específico de 'teacher' en esta escuela
          ]
        }
      ]
    }).select('_id name email').exec();
    
    this.logger.log(`Se encontraron ${teachers.length} profesores para la escuela ${schoolId}`);
    
    return teachers;
  }

  async searchUsersByEmail(email: string, requestingUserId: string, requestingUserRole: string, schoolId?: string): Promise<User[]> {
    this.logger.log(`Buscando usuarios con email similar a: ${email} por usuario: ${requestingUserId} (${requestingUserRole})`);
    
    // Validar entrada
    if (!email || email.length < 3) {
      throw new BadRequestException('La búsqueda debe tener al menos 3 caracteres');
    }
    
    // Construir la consulta base - buscar por email
    let query: any = { 
      email: { $regex: email, $options: 'i' }  // Case insensitive
    };
    
    // Restricción basada en roles
    const isSuperAdmin = requestingUserRole === UserRole.SUPER_ADMIN;
    const isAdmin = requestingUserRole === UserRole.ADMIN;
    const isSchoolOwner = requestingUserRole === UserRole.SCHOOL_OWNER;
    const isAdministrative = requestingUserRole === UserRole.ADMINISTRATIVE;
    
    // Super admin y admin pueden hacer búsquedas globales sin restricciones
    if (isSuperAdmin || isAdmin) {
      // No añadir restricciones adicionales - búsqueda global
      
      // Si se especifica una escuela, filtrar por esa escuela como opción adicional
      if (schoolId) {
        // Filtrado opcional por escuela, pero no obligatorio para estos roles
        query.schools = schoolId;
      }
    } 
    // School owner y administrative pueden hacer búsquedas globales pero deben tener la información de sus escuelas
    else if (isSchoolOwner || isAdministrative) {
      // Obtener las escuelas que puede gestionar el usuario solicitante
      const requestingUser = await this.userModel.findById(requestingUserId);
      if (!requestingUser) {
        throw new NotFoundException('Usuario no encontrado');
      }
      
      // Determinar qué escuelas puede gestionar
      let userSchoolIds = [];
      if (isSchoolOwner) {
        userSchoolIds = requestingUser.ownedSchools?.map(id => id.toString()) || [];
      } else if (isAdministrative) {
        userSchoolIds = requestingUser.administratedSchools?.map(id => id.toString()) || [];
      }
      
      // Si se especifica una escuela específica, verificar que tenga permisos para ella
      if (schoolId) {
        const canManageSchool = await this.canManageSchool(requestingUserId, schoolId);
        if (!canManageSchool) {
          throw new ForbiddenException('No tienes permiso para ver usuarios de esta escuela');
        }
        
        // Solo filtrar por esa escuela si el usuario tiene permiso
        query.schools = schoolId;
      } 
      // Si no se especifica escuela, no filtramos por escuela - permitiendo búsqueda global
      // pero mantenemos la información de las escuelas que puede gestionar para la lógica de asignación
    } else {
      // Otros roles como teacher o student solo pueden buscar en su propia escuela
      throw new ForbiddenException('No tienes permisos para buscar usuarios');
    }
    
    // Ejecutar la consulta con fields específicos para proteger datos sensibles
    return this.userModel.find(query)
      .select('_id name email role schoolRoles')
      .limit(10)  // Limitar resultados para evitar cargar demasiados datos
      .exec();
  }
  
  private async canManageSchool(userId: string, schoolId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Super admin puede gestionar cualquier escuela
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // Admin global puede gestionar cualquier escuela
    if (user.role === UserRole.ADMIN) return true;
    
    // School owner puede gestionar sus propias escuelas
    if (user.role === UserRole.SCHOOL_OWNER) {
      return user.ownedSchools.some(id => id.toString() === schoolId);
    }
    
    // Administrative puede gestionar las escuelas que administra
    if (user.role === UserRole.ADMINISTRATIVE) {
      return user.administratedSchools.some(id => id.toString() === schoolId);
    }
    
    return false;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<User> {
    
    
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    
    // Verify current password
    const isPasswordValid = await argon2.verify(user.password, changePasswordDto.currentPassword);
    if (!isPasswordValid) {
      
      throw new UnauthorizedException('Current password is incorrect');
    }
    
    // Check if new password is the same as the current one
    if (changePasswordDto.currentPassword === changePasswordDto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }
    
    // Hash new password
    const hashedPassword = await argon2.hash(changePasswordDto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 2**16,
      timeCost: 3,
      parallelism: 1
    });
    
    // Update password
    user.password = hashedPassword;
    await user.save();
    
    
    
    return user;
  }

  /**
   * Convierte un usuario no registrado (asistente) en un usuario registrado con email y password
   * @param unregisteredUserId ID del usuario no registrado
   * @param registerData Datos para el registro (email, password, etc)
   * @returns Usuario actualizado
   */
  async convertUnregisteredToRegistered(
    unregisteredUserId: string, 
    registerData: RegisterUnregisteredUserDto
  ): Promise<User> {
    
    
    // Verificar que el usuario existe y tiene rol UNREGISTERED
    const user = await this.userModel.findById(unregisteredUserId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${unregisteredUserId} no encontrado`);
    }
    
    // Verificar que el usuario tiene rol UNREGISTERED
    if (user.role.toString() !== UserRole.UNREGISTERED.toString()) {
      throw new BadRequestException(`El usuario ya está registrado con rol ${user.role}`);
    }
    
    // Verificar que el email no existe ya en otro usuario
    const existingUserWithEmail = await this.userModel.findOne({ email: registerData.email });
    if (existingUserWithEmail && existingUserWithEmail._id.toString() !== unregisteredUserId) {
      throw new BadRequestException(`Ya existe un usuario con el email ${registerData.email}`);
    }
    
    // Hashear la contraseña
    const hashedPassword = await argon2.hash(registerData.password, {
      type: argon2.argon2id,
      memoryCost: 2**16,
      timeCost: 3,
      parallelism: 1
    });
    
    // Actualizar el usuario
    const updatedFields: any = {
      email: registerData.email,
      password: hashedPassword,
      role: UserRole.STUDENT,
      ...registerData.additionalInfo
    };
    
    // Actualizar el usuario
    const updatedUser = await this.userModel.findByIdAndUpdate(
      unregisteredUserId,
      updatedFields,
      { new: true }
    );
    
    
    
    return updatedUser;
  }

  /**
   * Crea un usuario no registrado (asistente) directamente
   * @param name Nombre del usuario no registrado
   * @param courseId ID del curso al que se asociará (opcional)
   * @param schoolId ID de la escuela a la que se asociará (opcional)
   * @returns Usuario creado
   */
  async createUnregisteredUser(
    name: string,
    courseId?: string,
    schoolId?: string
  ): Promise<User> {
    
    
    try {
      // Generar un email único para el asistente
      const timestamp = Date.now();
      const uniqueEmail = `asistente.${timestamp}@temp.local`;
      
      // Acceso directo a la colección para mejor control
      const userCollection = this.userModel.collection;
      
      // Preparar el documento del usuario
      const userDocument: any = {
        name,
        email: uniqueEmail, // Email único para evitar conflictos
        role: 'unregistered',
        isActive: true,
        enrolledCourses: [],
        schools: [],
        schoolRoles: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Añadir courseId si se proporciona
      if (courseId) {
        userDocument.enrolledCourses = [new Types.ObjectId(courseId)];
      }
      
      // Añadir schoolId si se proporciona
      if (schoolId) {
        userDocument.schools = [new Types.ObjectId(schoolId)];
        userDocument.schoolRoles = [{
          schoolId: new Types.ObjectId(schoolId),
          role: 'student'
        }];
      }
      
      // Insertar directamente en MongoDB
      const result = await userCollection.insertOne(userDocument);
      
      
      // Si hay un courseId, añadir el usuario al curso
      if (courseId) {
        try {
          await this.courseModel.updateOne(
            { _id: new Types.ObjectId(courseId) },
            { $addToSet: { students: result.insertedId } }
          );
          
        } catch (error) {
          this.logger.error(`Error al añadir usuario al curso: ${error.message}`, error.stack);
        }
      }
      
      // Devolver el usuario creado como documento de Mongoose
      return await this.userModel.findById(result.insertedId).exec();
    } catch (error) {
      this.logger.error(`Error al crear usuario no registrado: ${error.message}`, error.stack);
      throw new BadRequestException(`Error al crear usuario no registrado: ${error.message}`);
    }
  }
} 