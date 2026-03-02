import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import * as argon2 from 'argon2';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Course } from '../courses/schemas/course.schema';
import { School } from '../schools/schemas/school.schema';
import { Attendance as CourseAttendance } from '../attendance/schemas/attendance.schema';
import { Attendance as ClassAttendance } from '../attendance/schemas/attendance.schema';

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
    @InjectModel(CourseAttendance.name)
    private courseAttendanceModel: Model<CourseAttendance>,
    @InjectModel(ClassAttendance.name)
    private classAttendanceModel: Model<ClassAttendance>,
  ) {}

  async findAll(
    requestUserId?: string,
    requestUserRole?: string,
  ): Promise<User[]> {
    // If no role info provided, return all users (backwards compatibility)
    if (!requestUserId || !requestUserRole) {
      return this.userModel.find().exec();
    }

    // Super admin and admin can see all users
    if (
      requestUserRole === UserRole.SUPER_ADMIN ||
      requestUserRole === UserRole.ADMIN
    ) {
      return this.userModel.find().exec();
    }

    // For school owners, show only users associated with their schools
    if (
      requestUserRole === UserRole.SCHOOL_OWNER ||
      requestUserRole === UserRole.ADMINISTRATIVE
    ) {
      // Get the requesting user with their school associations
      const requestingUser = await this.userModel
        .findById(requestUserId)
        .exec();
      if (!requestingUser) {
        throw new NotFoundException(`User with ID ${requestUserId} not found`);
      }

      // Get the schools this user can manage
      let managedSchoolIds: string[] = [];

      if (requestUserRole === UserRole.SCHOOL_OWNER) {
        managedSchoolIds =
          requestingUser.ownedSchools?.map((id) => id.toString()) || [];
      } else if (requestUserRole === UserRole.ADMINISTRATIVE) {
        managedSchoolIds =
          requestingUser.administratedSchools?.map((id) => id.toString()) || [];
      }

      if (managedSchoolIds.length === 0) {
        // If user has no schools, return empty array
        return [];
      }

      this.logger.log(
        `School owner/admin with schools: ${managedSchoolIds.join(', ')} is requesting users`,
      );

      // Find users associated with any of these schools
      // Users can be associated via:
      // 1. schools array
      // 2. schoolRoles
      // 3. enrolledCourses (indirectly through courses that belong to these schools)

      return this.userModel
        .find({
          $or: [
            { schools: { $in: managedSchoolIds } },
            {
              'schoolRoles.schoolId': {
                $in: managedSchoolIds.map((id) => new Types.ObjectId(id)),
              },
            },
            { ownedSchools: { $in: managedSchoolIds } },
            { administratedSchools: { $in: managedSchoolIds } },
          ],
        })
        .exec();
    }

    // Default fallback - return empty list for other roles
    return [];
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

  // Agregar un método para hashear contraseñas
  private async hashPassword(password: string): Promise<string> {
    try {
      // Si ya parece estar hasheada (comienza con $), devolverla como está
      if (password.startsWith('$')) {
        return password;
      }

      // Hashear con argon2
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
    } catch (error) {
      this.logger.error(
        `Error al hashear contraseña: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'No se pudo procesar de forma segura la contraseña',
      );
    }
  }

  async create(userData: Partial<User> & { courseId?: string }): Promise<User> {
    try {
      // Si hay una contraseña y no parece estar hasheada (no comienza con $), hashearla
      if (userData.password && !userData.password.startsWith('$')) {
        userData.password = await this.hashPassword(userData.password);
      } else if (userData.password) {
        this.logger.debug(
          `La contraseña para ${userData.email} ya parece estar hasheada, manteniéndola como está`,
        );
      }

      // Extract courseId from userData to handle separately
      const { courseId, ...userDataWithoutCourse } = userData;

      // Create user first
      const createdUser = new this.userModel(userDataWithoutCourse);
      const savedUser = await createdUser.save();

      // If courseId is provided, enroll user in course
      if (courseId) {
        this.logger.log(
          `Enrolling user ${savedUser._id} in course: ${courseId}`,
        );
        try {
          // Add course to user's enrolledCourses
          await this.userModel.findByIdAndUpdate(
            savedUser._id,
            { $addToSet: { enrolledCourses: new Types.ObjectId(courseId) } },
            { new: true },
          );

          // Add user to course's students
          await this.courseModel.findByIdAndUpdate(
            courseId,
            { $addToSet: { students: savedUser._id } },
            { new: true },
          );

          // Get course to find the school and add user to school
          const course = await this.courseModel.findById(courseId).exec();
          if (course && course.school) {
            const schoolId = course.school.toString();

            // Add user to school's students array
            await this.schoolModel.findByIdAndUpdate(
              schoolId,
              { $addToSet: { students: savedUser._id } },
              { new: true },
            );

            // Add school to user's schools array
            await this.userModel.findByIdAndUpdate(
              savedUser._id,
              { $addToSet: { schools: new Types.ObjectId(schoolId) } },
              { new: true },
            );
          }

          // Return updated user
          return this.userModel.findById(savedUser._id).exec();
        } catch (enrollmentError) {
          this.logger.error(
            `Error enrolling user in course: ${enrollmentError.message}`,
            enrollmentError.stack,
          );
          // Return user even if enrollment fails
          return savedUser;
        }
      }

      return savedUser;
    } catch (error) {
      this.logger.error(
        `Error al crear usuario: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createWithCourses(
    userData: Partial<User>,
    courseIds: string[] = [],
  ): Promise<User> {
    try {
      // Si hay una contraseña y no parece estar hasheada (no comienza con $), hashearla
      if (userData.password && !userData.password.startsWith('$')) {
        userData.password = await this.hashPassword(userData.password);
      } else if (userData.password) {
        this.logger.debug(
          `La contraseña para ${userData.email} ya parece estar hasheada, manteniéndola como está`,
        );
      }

      // Crear usuario básico
      const createdUser = new this.userModel({
        ...userData,
        enrolledCourses: courseIds,
      });

      // Guardar el usuario
      const savedUser = await createdUser.save();

      // Si hay cursos, actualizar la relación en los cursos también
      if (courseIds && courseIds.length > 0) {
        // Actualizar los cursos para incluir al estudiante
        await this.enrollUserInCourses(savedUser._id, courseIds);

        // Get the schools from these courses and assign the user role in each school
        await this.assignUserRoleToSchoolsFromCourses(
          savedUser._id,
          courseIds,
          userData.role || 'student',
        );
      }

      return savedUser;
    } catch (error) {
      this.logger.error(
        `Error al crear usuario con cursos: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async enrollUserInCourses(
    userId: string | Types.ObjectId,
    courseIds: string[],
  ): Promise<void> {
    try {
      // Use the injected course model
      const userObjectId =
        typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      // Actualizar cada curso
      for (const courseId of courseIds) {
        await this.courseModel.findByIdAndUpdate(
          courseId,
          { $addToSet: { students: userObjectId } },
          { new: true },
        );
      }
    } catch (error) {
      this.logger.error(
        `Error enrolling user in courses: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Helper method to assign user roles to schools based on the courses
   */
  private async assignUserRoleToSchoolsFromCourses(
    userId: string | Types.ObjectId,
    courseIds: string[],
    userRole: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Assigning user ${userId} to schools from courses ${courseIds} with role ${userRole}`,
      );

      // Get the courses to identify their schools
      const courses = await this.courseModel.find({ _id: { $in: courseIds } });

      // Extract unique school IDs
      const schoolIds: string[] = [];

      // Safely extract school IDs
      for (const course of courses) {
        if (course.school) {
          let schoolId: string;

          if (typeof course.school === 'object' && course.school !== null) {
            // Use type assertion to handle mongoose document
            const schoolObj = course.school as any;
            schoolId = schoolObj._id
              ? schoolObj._id.toString()
              : schoolObj.toString();
          } else {
            // If it's a string or ObjectId
            schoolId = course.school.toString();
          }

          if (schoolId && !schoolIds.includes(schoolId)) {
            schoolIds.push(schoolId);
          }
        }
      }

      this.logger.log(`Found schools: ${schoolIds}`);

      // For each school, add the user to the school's arrays
      const userObjectId =
        typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      for (const schoolId of schoolIds) {
        // Add user to school based on their role
        if (userRole === 'teacher') {
          await this.schoolModel.findByIdAndUpdate(
            schoolId,
            { $addToSet: { teachers: userObjectId } },
            { new: true },
          );
        } else if (userRole === 'administrative') {
          await this.schoolModel.findByIdAndUpdate(
            schoolId,
            { $addToSet: { administratives: userObjectId } },
            { new: true },
          );
        } else {
          // Default to student
          await this.schoolModel.findByIdAndUpdate(
            schoolId,
            { $addToSet: { students: userObjectId } },
            { new: true },
          );
        }

        // Also add school to user's schools array
        await this.userModel.findByIdAndUpdate(
          userId,
          { $addToSet: { schools: new Types.ObjectId(schoolId) } },
          { new: true },
        );
      }
    } catch (error) {
      this.logger.error(
        `Error assigning user to schools: ${error.message}`,
        error.stack,
      );
      // We don't throw here to avoid blocking the user creation
    }
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(id, userData, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async deleteSelf(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Estrategia de borrado:
    // 1. Eliminar referencias en cursos (como estudiante)
    if (user.enrolledCourses && user.enrolledCourses.length > 0) {
      await this.courseModel.updateMany(
        { _id: { $in: user.enrolledCourses } },
        { $pull: { students: userId } },
      );
    }

    // 2. Eliminar referencias en escuelas (como estudiante/profesor)
    if (user.schools && user.schools.length > 0) {
      await this.schoolModel.updateMany(
        { _id: { $in: user.schools } },
        { $pull: { students: userId, teachers: userId, administratives: userId } },
      );
    }

    // 3. Anonimizar o eliminar registros de asistencia (opcional, depende de requerimientos legales)
    // En este caso, eliminamos los registros donde el usuario es el estudiante
    await this.classAttendanceModel.deleteMany({ student: userId });
    await this.courseAttendanceModel.deleteMany({ student: userId, studentModel: 'User' });

    // 4. Eliminar el usuario permanentemente
    await this.userModel.findByIdAndDelete(userId);
    
    this.logger.log(`User ${userId} deleted their own account`);
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
          { $pull: { students: id } },
        );
      }

      if (user.teachingCourses && user.teachingCourses.length > 0) {
        // Note: Not automatically deleting courses - this would require business logic for teacher reassignment
      }

      // Remove user references from schools
      if (user.schools && user.schools.length > 0) {
        await this.schoolModel.updateMany(
          { _id: { $in: user.schools } },
          { $pull: { students: id, teachers: id } },
        );
      }

      if (user.administratedSchools && user.administratedSchools.length > 0) {
        // Note: Not automatically reassigning school admins - this would require business logic
      }

      // Clean up course attendance records
      // 1. Find course attendance records where this user is the student
      const studentCourseAttendanceCount =
        await this.courseAttendanceModel.countDocuments({
          student: id,
          studentModel: 'User',
        });

      if (studentCourseAttendanceCount > 0) {
        await this.courseAttendanceModel.deleteMany({
          student: id,
          studentModel: 'User',
        });
      }

      // 2. Find course attendance records where this user marked the attendance
      const markedCourseAttendanceCount =
        await this.courseAttendanceModel.countDocuments({ markedBy: id });
      if (markedCourseAttendanceCount > 0) {
        await this.courseAttendanceModel.updateMany(
          { markedBy: id },
          { $set: { markedBy: null } },
        );
      }

      // Clean up class attendance records
      // 1. Find class attendance records where this user is the student
      const studentClassAttendanceCount =
        await this.classAttendanceModel.countDocuments({
          student: id,
        });

      if (studentClassAttendanceCount > 0) {
        await this.classAttendanceModel.deleteMany({
          student: id,
        });
      }

      // 2. Find class attendance records where this user recorded the attendance
      const recordedClassAttendanceCount =
        await this.classAttendanceModel.countDocuments({ recordedBy: id });
      if (recordedClassAttendanceCount > 0) {
        await this.classAttendanceModel.updateMany(
          { recordedBy: id },
          { $set: { recordedBy: null } },
        );
      }

      // Delete the user
      const deletedUser = await this.userModel.findByIdAndDelete(id).exec();

      return deletedUser;
    } catch (error) {
      this.logger.error(
        `Error removing user ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async changeRole(userId: string, role: UserRole): Promise<User> {
    // Validar que el rol sea uno de los permitidos
    if (!Object.values(UserRole).includes(role)) {
      throw new BadRequestException('Invalid role');
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { role }, { new: true })
      .exec();

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
    // 2. Tengan un schoolRole de 'teacher' para esta escuela específica, O
    // 3. Tengan rol global SCHOOL_OWNER y estén en la escuela, O
    // 4. Tengan un schoolRole de 'school_owner' para esta escuela específica
    const teachers = await this.userModel
      .find({
        $and: [
          { schools: schoolId }, // Deben estar asociados a la escuela
          {
            $or: [
              { role: UserRole.TEACHER }, // Rol global es TEACHER
              { role: UserRole.SCHOOL_OWNER }, // Rol global es SCHOOL_OWNER
              {
                schoolRoles: {
                  $elemMatch: {
                    schoolId: new Types.ObjectId(schoolId),
                    role: { $in: ['teacher', 'school_owner'] },
                  },
                },
              }, // O tienen un rol específico de 'teacher' o 'school_owner' en esta escuela
            ],
          },
        ],
      })
      .select('_id name email')
      .collation({ locale: 'es', strength: 2 }) // Collation para ordenamiento correcto de caracteres españoles
      .sort({ name: 1 }) // Ordenar alfabéticamente por nombre (1 = ascendente)
      .exec();

    this.logger.log(
      `Se encontraron ${teachers.length} profesores para la escuela ${schoolId}`,
    );

    return teachers;
  }

  async searchUsersByEmail(
    email: string,
    requestingUserId: string,
    requestingUserRole: string,
    schoolId?: string,
  ): Promise<User[]> {
    this.logger.log(
      `Buscando usuarios con email similar a: ${email} por usuario: ${requestingUserId} (${requestingUserRole})`,
    );

    // Validar entrada
    if (!email || email.length < 3) {
      throw new BadRequestException(
        'La búsqueda debe tener al menos 3 caracteres',
      );
    }

    // Construir la consulta base - buscar por email
    const query: any = {
      email: { $regex: email, $options: 'i' }, // Case insensitive
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
        userSchoolIds =
          requestingUser.ownedSchools?.map((id) => id.toString()) || [];
      } else if (isAdministrative) {
        userSchoolIds =
          requestingUser.administratedSchools?.map((id) => id.toString()) || [];
      }

      // Si se especifica una escuela específica, verificar que tenga permisos para ella
      if (schoolId) {
        const canManageSchool = await this.canManageSchool(
          requestingUserId,
          schoolId,
        );
        if (!canManageSchool) {
          throw new ForbiddenException(
            'No tienes permiso para ver usuarios de esta escuela',
          );
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
    return this.userModel
      .find(query)
      .select('_id name email role schoolRoles')
      .limit(10) // Limitar resultados para evitar cargar demasiados datos
      .exec();
  }

  private async canManageSchool(
    userId: string,
    schoolId: string,
  ): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user) return false;

    // Super admin puede gestionar cualquier escuela
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // Admin global puede gestionar cualquier escuela
    if (user.role === UserRole.ADMIN) return true;

    // School owner puede gestionar sus propias escuelas
    if (user.role === UserRole.SCHOOL_OWNER) {
      return user.ownedSchools.some((id) => id.toString() === schoolId);
    }

    // Administrative puede gestionar las escuelas que administra
    if (user.role === UserRole.ADMINISTRATIVE) {
      return user.administratedSchools.some((id) => id.toString() === schoolId);
    }

    return false;
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Only verify current password if it's provided
    if (changePasswordDto.currentPassword) {
      // Verify current password
      const isPasswordValid = await argon2.verify(
        user.password,
        changePasswordDto.currentPassword,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      // Check if new password is the same as the current one
      if (changePasswordDto.currentPassword === changePasswordDto.newPassword) {
        throw new BadRequestException(
          'New password must be different from the current password',
        );
      }
    }

    // Hash new password (either newPassword or password field)
    const passwordToHash =
      changePasswordDto.newPassword || changePasswordDto.password;
    if (!passwordToHash) {
      throw new BadRequestException('No password provided for update');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(passwordToHash, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
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
    registerData: RegisterUnregisteredUserDto,
  ): Promise<User> {
    // Verificar que el usuario existe y tiene rol UNREGISTERED
    const user = await this.userModel.findById(unregisteredUserId);
    if (!user) {
      throw new NotFoundException(
        `Usuario con ID ${unregisteredUserId} no encontrado`,
      );
    }

    // Verificar que el usuario tiene rol UNREGISTERED
    if (user.role.toString() !== UserRole.UNREGISTERED.toString()) {
      throw new BadRequestException(
        `El usuario ya está registrado con rol ${user.role}`,
      );
    }

    // Verificar que el email no existe ya en otro usuario
    const existingUserWithEmail = await this.userModel.findOne({
      email: registerData.email,
    });
    if (
      existingUserWithEmail &&
      existingUserWithEmail._id.toString() !== unregisteredUserId
    ) {
      throw new BadRequestException(
        `Ya existe un usuario con el email ${registerData.email}`,
      );
    }

    // Hashear la contraseña
    const hashedPassword = await argon2.hash(registerData.password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    // Actualizar el usuario
    const updatedFields: any = {
      email: registerData.email,
      password: hashedPassword,
      role: UserRole.STUDENT,
      ...registerData.additionalInfo,
    };

    // Actualizar el usuario
    const updatedUser = await this.userModel.findByIdAndUpdate(
      unregisteredUserId,
      updatedFields,
      { new: true },
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
    schoolId?: string,
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
        updatedAt: new Date(),
      };

      // If courseId is provided, get the school from the course
      if (courseId) {
        userDocument.enrolledCourses = [new Types.ObjectId(courseId)];

        // If no schoolId provided but courseId exists, get school from course
        if (!schoolId) {
          try {
            const course = await this.courseModel.findById(courseId).exec();
            if (course && course.school) {
              schoolId = course.school.toString();
            }
          } catch (error) {
            this.logger.warn(
              `Could not get school from course ${courseId}: ${error.message}`,
            );
          }
        }
      }

      // Add schoolId if provided or derived from course
      if (schoolId) {
        userDocument.schools = [new Types.ObjectId(schoolId)];
        userDocument.schoolRoles = [
          {
            schoolId: new Types.ObjectId(schoolId),
            role: 'student',
          },
        ];
      }

      // Insertar directamente en MongoDB
      const result = await userCollection.insertOne(userDocument);

      // If there's a courseId, add user to course and school
      if (courseId) {
        try {
          // Add user to course's students array
          await this.courseModel.updateOne(
            { _id: new Types.ObjectId(courseId) },
            { $addToSet: { students: result.insertedId } },
          );

          // If we have a schoolId (either provided or derived), add user to school's students array
          if (schoolId) {
            await this.schoolModel.updateOne(
              { _id: new Types.ObjectId(schoolId) },
              { $addToSet: { students: result.insertedId } },
            );
          }
        } catch (error) {
          this.logger.error(
            `Error al añadir usuario al curso/escuela: ${error.message}`,
            error.stack,
          );
        }
      }

      // Devolver el usuario creado como documento de Mongoose
      return await this.userModel.findById(result.insertedId).exec();
    } catch (error) {
      this.logger.error(
        `Error al crear usuario no registrado: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al crear usuario no registrado: ${error.message}`,
      );
    }
  }

  async findUnregistered(
    authUserId: string,
    authUserRole: string,
  ): Promise<User[]> {
    this.logger.log(
      `User ${authUserId} (${authUserRole}) fetching unregistered users.`,
    );
    // Example: Find users with a specific role or flag indicating they are unregistered
    // This is a placeholder, adjust the query based on your actual User schema for unregistered users
    const unregisteredUsers = await this.userModel
      .find({ role: 'unregistered' })
      .exec();
    if (!unregisteredUsers) {
      throw new NotFoundException('No unregistered users found.');
    }
    return unregisteredUsers.map((user) => user.toObject() as User);
  }

  async updateUserStatus(
    userId: string,
    status: string,
    changedBy: string,
    reason?: string,
  ): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Update status
    (user as any).status = status;

    // Add to status history
    if (!(user as any).statusHistory) {
      (user as any).statusHistory = [];
    }

    (user as any).statusHistory.push({
      status: status,
      changedAt: new Date(),
      changedBy,
      reason,
    });

    return user.save();
  }

  async findAllWithStatus(
    includeInactive: boolean = false,
    requestUserId?: string,
    requestUserRole?: string,
  ): Promise<User[]> {
    // Get base query result
    const users = await this.findAll(requestUserId, requestUserRole);

    // Filter by status if needed
    if (!includeInactive) {
      return users.filter(
        (user) => (user as any).status === 'active' || !(user as any).status,
      );
    }

    return users;
  }

  async getUserStats(): Promise<any> {
    const { UserStatus } = await import('./schemas/user.schema');

    const stats = await this.userModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await this.userModel.countDocuments();
    const active =
      stats.find((s) => s._id === UserStatus.ACTIVE || s._id === null)?.count ||
      0;
    const inactive =
      stats.find((s) => s._id === UserStatus.INACTIVE)?.count || 0;
    const suspended =
      stats.find((s) => s._id === UserStatus.SUSPENDED)?.count || 0;

    return {
      total,
      active,
      inactive,
      suspended,
    };
  }
}
