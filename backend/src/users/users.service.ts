import { Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import * as argon2 from 'argon2';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Course } from '../courses/schemas/course.schema';

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
    this.logger.log(`Creando usuario con ${courseIds.length} cursos`);
    
    // Crear usuario básico
    const createdUser = new this.userModel({
      ...userData,
      enrolledCourses: courseIds
    });
    
    // Guardar el usuario
    const savedUser = await createdUser.save();
    
    // Si hay cursos, actualizar la relación en los cursos también
    if (courseIds && courseIds.length > 0) {
      this.logger.log(`Matriculando usuario ${savedUser._id} en ${courseIds.length} cursos`);
      
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
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async changeRole(userId: string, role: UserRole): Promise<User> {
    this.logger.log(`Changing role for user ${userId} to ${role}`);
    
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

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<User> {
    this.logger.log(`Attempting to change password for user ${userId}`);
    
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    
    // Verify current password
    const isPasswordValid = await argon2.verify(user.password, changePasswordDto.currentPassword);
    if (!isPasswordValid) {
      this.logger.warn(`Invalid current password for user ${userId}`);
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
    
    this.logger.log(`Password changed successfully for user ${userId}`);
    
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
    this.logger.log(`Convirtiendo usuario no registrado ${unregisteredUserId} a usuario registrado`);
    
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
    
    this.logger.log(`Usuario ${unregisteredUserId} convertido exitosamente a usuario registrado`);
    
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
    this.logger.log(`Creando usuario no registrado: ${name}`);
    
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
      this.logger.log(`Usuario no registrado creado con ID: ${result.insertedId}`);
      
      // Si hay un courseId, añadir el usuario al curso
      if (courseId) {
        try {
          await this.courseModel.updateOne(
            { _id: new Types.ObjectId(courseId) },
            { $addToSet: { students: result.insertedId } }
          );
          this.logger.log(`Usuario añadido al curso: ${courseId}`);
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