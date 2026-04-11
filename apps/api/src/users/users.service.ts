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
import { AuthorizationService } from '../auth/services/authorization.service';

// DTOs para los nuevos métodos
class RegisterUnregisteredUserDto {
  email: string;
  password: string;
  additionalInfo?: {
    [key: string]: any;
  };
}

interface AssignCourseSeatDto {
  schoolId: string;
  courseId: string;
  ownerId?: string;
}

interface OwnerSeatQuotaResult {
  ownerId: string;
  schoolId: string;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
}

interface OwnerSeatQuotaReportRow extends OwnerSeatQuotaResult {
  ownerName: string;
  ownerEmail: string;
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
    private readonly authorizationService: AuthorizationService,
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
    const user = await this.userModel.findById(id).select('-password').exec();
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
    const sanitizedUserData = { ...userData } as Partial<User>;
    delete (sanitizedUserData as any).canCreateSchool;
    const user = await this.userModel
      .findByIdAndUpdate(id, sanitizedUserData, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async setCanCreateSchool(
    userId: string,
    canCreateSchool: boolean,
  ): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { canCreateSchool: canCreateSchool === true },
        { new: true },
      )
      .exec();

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  async deleteSelf(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).select('+password');
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
        {
          $pull: {
            students: userId,
            teachers: userId,
            administratives: userId,
          },
        },
      );
    }

    // 3. Anonimizar o eliminar registros de asistencia (opcional, depende de requerimientos legales)
    // En este caso, eliminamos los registros donde el usuario es el estudiante
    await this.classAttendanceModel.deleteMany({ student: userId });
    await this.courseAttendanceModel.deleteMany({
      student: userId,
      studentModel: 'User',
    });

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

  async removeRoleInSchool(
    userId: string,
    schoolId: string,
    role: string,
  ): Promise<User> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(schoolId)) {
      throw new BadRequestException('Invalid school ID');
    }

    const normalizedRole = String(role || '').toLowerCase().trim();
    const validRoles = [
      UserRole.SCHOOL_OWNER,
      UserRole.ADMIN,
      UserRole.ADMINISTRATIVE,
      UserRole.TEACHER,
      UserRole.STUDENT,
      UserRole.UNREGISTERED,
    ];
    if (!validRoles.includes(normalizedRole as UserRole)) {
      throw new BadRequestException(
        `Invalid role. Allowed: ${validRoles.join(', ')}`,
      );
    }

    const [user, school] = await Promise.all([
      this.userModel.findById(userId),
      this.schoolModel.findById(schoolId),
    ]);

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    if (!school) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    }

    const hasContextRole = user.schoolRoles?.some(
      (item) =>
        item.schoolId?.toString() === schoolId &&
        String(item.role || '').toLowerCase() === normalizedRole,
    );

    const hasLegacyOwner =
      normalizedRole === UserRole.SCHOOL_OWNER &&
      user.ownedSchools?.some((id) => id.toString() === schoolId);
    const hasLegacyAdminOrAdministrative =
      (normalizedRole === UserRole.ADMIN ||
        normalizedRole === UserRole.ADMINISTRATIVE) &&
      user.administratedSchools?.some((id) => id.toString() === schoolId);

    if (!hasContextRole && !hasLegacyOwner && !hasLegacyAdminOrAdministrative) {
      throw new BadRequestException(
        'User does not have this role in the selected school',
      );
    }

    const isCurrentMainOwner = school.admin?.toString() === userId;
    if (normalizedRole === UserRole.SCHOOL_OWNER && isCurrentMainOwner) {
      throw new BadRequestException(
        'Cannot remove the active school owner. Transfer ownership first.',
      );
    }

    user.schoolRoles = (user.schoolRoles || []).filter(
      (item) =>
        !(
          item.schoolId?.toString() === schoolId &&
          String(item.role || '').toLowerCase() === normalizedRole
        ),
    );

    if (
      normalizedRole === UserRole.ADMIN ||
      normalizedRole === UserRole.ADMINISTRATIVE
    ) {
      user.administratedSchools = (user.administratedSchools || []).filter(
        (id) => id.toString() !== schoolId,
      );
      await this.schoolModel.findByIdAndUpdate(schoolId, {
        $pull: { administratives: new Types.ObjectId(userId) },
      });
    }

    if (normalizedRole === UserRole.SCHOOL_OWNER) {
      user.ownedSchools = (user.ownedSchools || []).filter(
        (id) => id.toString() !== schoolId,
      );
    }

    if (normalizedRole === UserRole.TEACHER) {
      await this.schoolModel.findByIdAndUpdate(schoolId, {
        $pull: { teachers: new Types.ObjectId(userId) },
      });
    }

    if (normalizedRole === UserRole.STUDENT || normalizedRole === UserRole.UNREGISTERED) {
      await this.schoolModel.findByIdAndUpdate(schoolId, {
        $pull: { students: new Types.ObjectId(userId) },
      });
    }

    const stillHasAnyRoleInSchool =
      user.schoolRoles?.some((item) => item.schoolId?.toString() === schoolId) ||
      user.ownedSchools?.some((id) => id.toString() === schoolId) ||
      user.administratedSchools?.some((id) => id.toString() === schoolId);

    if (!stillHasAnyRoleInSchool) {
      user.schools = (user.schools || []).filter((id) => id.toString() !== schoolId);
    }

    await user.save();
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

    // Restricción basada en permisos reales sobre la escuela, no solo en el rol global
    const isSuperAdmin = requestingUserRole === UserRole.SUPER_ADMIN;

    if (isSuperAdmin) {
      // Sin restricciones adicionales.
    } else if (schoolId) {
      const canManageSchool = await this.canManageSchool(
        requestingUserId,
        schoolId,
      );
      if (!canManageSchool) {
        const canSearchInSchool = await this.canTeacherSearchUsersInSchool(
          requestingUserId,
          schoolId,
        );
        if (!canSearchInSchool) {
          throw new ForbiddenException(
            'No tienes permiso para ver usuarios de esta escuela',
          );
        }
      }
    } else {
      throw new ForbiddenException(
        'Debes seleccionar una escuela para buscar usuarios',
      );
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

    const isOwner =
      user.ownedSchools?.some((id) => id.toString() === schoolId) || false;
    if (isOwner) {
      return true;
    }

    const isAdministrative =
      user.administratedSchools?.some((id) => id.toString() === schoolId) ||
      false;
    if (isAdministrative) {
      return true;
    }

    return (
      user.schoolRoles?.some(
        (entry) =>
          entry.schoolId?.toString() === schoolId &&
          [
            UserRole.SCHOOL_OWNER,
            UserRole.ADMIN,
            UserRole.ADMINISTRATIVE,
          ].includes(String(entry.role || '').toLowerCase() as UserRole),
      ) || false
    );
  }

  private async canTeacherSearchUsersInSchool(
    userId: string,
    schoolId: string,
  ): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select('schools schoolRoles')
      .exec();
    if (!user) return false;

    const belongsToSchool =
      user.schools?.some((id) => id.toString() === schoolId) || false;
    if (belongsToSchool) {
      return true;
    }

    const hasTeacherSchoolRole =
      user.schoolRoles?.some(
        (role) =>
          role.schoolId?.toString() === schoolId &&
          String(role.role || '').toLowerCase() === UserRole.TEACHER,
      ) || false;
    if (hasTeacherSchoolRole) {
      return true;
    }

    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(schoolId)) {
      return false;
    }

    const teachesInSchool = await this.courseModel.exists({
      school: new Types.ObjectId(schoolId),
      $or: [
        { teacher: new Types.ObjectId(userId) },
        { teachers: new Types.ObjectId(userId) },
      ],
    });

    return !!teachesInSchool;
  }

  private async getOwnerUsedSeats(
    ownerId: string,
    schoolId: string,
  ): Promise<number> {
    const result = await this.userModel.aggregate([
      { $unwind: '$courseSeatGrants' },
      {
        $match: {
          $or: [
            { role: UserRole.STUDENT },
            {
              schoolRoles: {
                $elemMatch: {
                  schoolId: new Types.ObjectId(schoolId),
                  role: UserRole.STUDENT,
                },
              },
            },
          ],
          'courseSeatGrants.schoolId': new Types.ObjectId(schoolId),
          'courseSeatGrants.isActive': true,
          $and: [
            {
              $or: [
                { 'courseSeatGrants.quotaOwnerId': new Types.ObjectId(ownerId) },
                {
                  'courseSeatGrants.quotaOwnerId': { $exists: false },
                  'courseSeatGrants.assignedBy': new Types.ObjectId(ownerId),
                },
              ],
            },
          ],
        },
      },
      { $count: 'count' },
    ]);

    return result?.[0]?.count || 0;
  }

  private async isOwnerForSchool(
    owner: User,
    schoolId: string,
  ): Promise<boolean> {
    const inOwnedSchools =
      owner.ownedSchools?.some((id) => id.toString() === schoolId) || false;
    if (inOwnedSchools) return true;

    const inSchoolRoles =
      owner.schoolRoles?.some(
        (role) =>
          role.schoolId?.toString() === schoolId &&
          String(role.role).toLowerCase() === UserRole.SCHOOL_OWNER,
      ) || false;
    if (inSchoolRoles) return true;

    const school = await this.schoolModel.findById(schoolId).select('admin').lean();
    const schoolAdminId =
      school?.admin && typeof school.admin === 'object'
        ? String((school.admin as any)._id || school.admin)
        : school?.admin
          ? String(school.admin)
          : '';

    return schoolAdminId === String((owner as any)._id);
  }

  private async listSchoolOwners(schoolId: string): Promise<User[]> {
    const owners = await this.userModel
      .find({
        $or: [
          {
            role: UserRole.SCHOOL_OWNER,
            $or: [
              { ownedSchools: new Types.ObjectId(schoolId) },
              {
                schoolRoles: {
                  $elemMatch: {
                    schoolId: new Types.ObjectId(schoolId),
                    role: UserRole.SCHOOL_OWNER,
                  },
                },
              },
            ],
          },
          {
            schoolRoles: {
              $elemMatch: {
                schoolId: new Types.ObjectId(schoolId),
                role: UserRole.SCHOOL_OWNER,
              },
            },
          },
        ],
      })
      .exec();

    const school = await this.schoolModel.findById(schoolId).select('admin').lean();
    const schoolAdminId =
      school?.admin && typeof school.admin === 'object'
        ? String((school.admin as any)._id || school.admin)
        : school?.admin
          ? String(school.admin)
          : '';

    if (!schoolAdminId || !Types.ObjectId.isValid(schoolAdminId)) {
      return owners;
    }

    const alreadyIncluded = owners.some(
      (owner) => String((owner as any)._id) === schoolAdminId,
    );
    if (alreadyIncluded) {
      return owners;
    }

    const schoolAdmin = await this.userModel.findById(schoolAdminId).exec();
    return schoolAdmin ? [schoolAdmin, ...owners] : owners;
  }

  private async resolveQuotaOwnerId(
    schoolId: string,
    assigner: User,
    normalizedRole: string,
    requestedOwnerId?: string,
  ): Promise<string> {
    if (normalizedRole === UserRole.SCHOOL_OWNER) {
      const ownerHasSchool = await this.isOwnerForSchool(assigner, schoolId);
      if (!ownerHasSchool) {
        throw new ForbiddenException(
          'School owner can only assign seats in owned schools',
        );
      }
      return (assigner as any)._id.toString();
    }

    if (requestedOwnerId) {
      if (!Types.ObjectId.isValid(requestedOwnerId)) {
        throw new BadRequestException('Invalid ownerId');
      }
      const targetOwner = await this.userModel
        .findById(requestedOwnerId)
        .exec();
      if (!targetOwner) {
        throw new NotFoundException(
          `Owner with ID ${requestedOwnerId} not found`,
        );
      }
      const ownerHasSchool = await this.isOwnerForSchool(targetOwner, schoolId);
      if (!ownerHasSchool) {
        throw new BadRequestException(
          'Target owner does not belong to this school',
        );
      }
      return requestedOwnerId;
    }

    const owners = await this.listSchoolOwners(schoolId);
    if (!owners.length) {
      throw new BadRequestException(
        'No school_owner found for this school. Set an owner before assigning seats.',
      );
    }

    if (owners.length === 1) {
      return (owners[0] as any)._id.toString();
    }

    const quotaRows = await Promise.all(
      owners.map(async (owner) => {
        const ownerDoc = owner as any;
        const quota = await this.getOwnerSeatQuota(
          ownerDoc._id.toString(),
          schoolId,
        );
        return {
          ownerId: ownerDoc._id.toString(),
          availableSeats: quota.availableSeats,
        };
      }),
    );

    quotaRows.sort((a, b) => b.availableSeats - a.availableSeats);
    return quotaRows[0].ownerId;
  }

  async setOwnerSeatQuota(
    ownerId: string,
    schoolId: string,
    totalSeats: number,
  ): Promise<OwnerSeatQuotaResult> {
    if (!Types.ObjectId.isValid(ownerId)) {
      throw new BadRequestException('Invalid owner ID');
    }
    if (!Types.ObjectId.isValid(schoolId)) {
      throw new BadRequestException('Invalid school ID');
    }
    if (!Number.isInteger(totalSeats) || totalSeats < 0) {
      throw new BadRequestException('totalSeats must be an integer >= 0');
    }

    const [owner, school] = await Promise.all([
      this.userModel.findById(ownerId),
      this.schoolModel.findById(schoolId),
    ]);

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }
    if (!school) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    }

    const ownerHasSchool = await this.isOwnerForSchool(owner, schoolId);
    if (!ownerHasSchool) {
      throw new BadRequestException(
        'Target user is not a school_owner for this school',
      );
    }

    const ownerDoc = owner as any;
    if (!Array.isArray(ownerDoc.ownerSeatQuotas)) {
      ownerDoc.ownerSeatQuotas = [];
    }

    const existingIndex = ownerDoc.ownerSeatQuotas.findIndex(
      (quota) => quota.schoolId?.toString() === schoolId,
    );

    if (existingIndex >= 0) {
      ownerDoc.ownerSeatQuotas[existingIndex].totalSeats = totalSeats;
      ownerDoc.ownerSeatQuotas[existingIndex].updatedAt = new Date();
    } else {
      ownerDoc.ownerSeatQuotas.push({
        schoolId: new Types.ObjectId(schoolId),
        totalSeats,
        updatedAt: new Date(),
      });
    }

    await owner.save();
    return this.getOwnerSeatQuota(ownerId, schoolId);
  }

  async getOwnerSeatQuota(
    ownerId: string,
    schoolId: string,
  ): Promise<OwnerSeatQuotaResult> {
    if (!Types.ObjectId.isValid(ownerId)) {
      throw new BadRequestException('Invalid owner ID');
    }
    if (!Types.ObjectId.isValid(schoolId)) {
      throw new BadRequestException('Invalid school ID');
    }

    const owner = await this.userModel.findById(ownerId);
    if (!owner) {
      throw new NotFoundException(`Owner with ID ${ownerId} not found`);
    }

    const quotas = (owner as any).ownerSeatQuotas || [];
    const quota = quotas.find((item) => item.schoolId?.toString() === schoolId);
    const totalSeats = quota?.totalSeats || 0;
    const usedSeats = await this.getOwnerUsedSeats(ownerId, schoolId);

    return {
      ownerId,
      schoolId,
      totalSeats,
      usedSeats,
      availableSeats: Math.max(totalSeats - usedSeats, 0),
    };
  }

  async getOwnerSeatQuotaReportBySchool(
    schoolId: string,
    requestUserId: string,
    requestUserRole: string,
  ): Promise<{
    schoolId: string;
    totals: { totalSeats: number; usedSeats: number; availableSeats: number };
    owners: OwnerSeatQuotaReportRow[];
  }> {
    if (!Types.ObjectId.isValid(schoolId)) {
      throw new BadRequestException('Invalid school ID');
    }

    const canManage = await this.canManageSchool(requestUserId, schoolId);
    if (!canManage) {
      throw new ForbiddenException('No permission to view seat quota report');
    }

    const normalizedRole = String(requestUserRole || '').toLowerCase();
    const owners = await this.listSchoolOwners(schoolId);

    let targetOwners = owners;
    if (normalizedRole === UserRole.SCHOOL_OWNER) {
      targetOwners = owners.filter(
        (owner) => (owner as any)._id.toString() === requestUserId,
      );
    }

    const rows: OwnerSeatQuotaReportRow[] = await Promise.all(
      targetOwners.map(async (owner) => {
        const ownerDoc = owner as any;
        const quota = await this.getOwnerSeatQuota(
          ownerDoc._id.toString(),
          schoolId,
        );
        return {
          ownerId: ownerDoc._id.toString(),
          ownerName: owner.name || 'Sin nombre',
          ownerEmail: owner.email || 'Sin email',
          schoolId,
          totalSeats: quota.totalSeats,
          usedSeats: quota.usedSeats,
          availableSeats: quota.availableSeats,
        };
      }),
    );

    rows.sort((a, b) => b.totalSeats - a.totalSeats);

    const totals = rows.reduce(
      (acc, row) => {
        acc.totalSeats += row.totalSeats;
        acc.usedSeats += row.usedSeats;
        acc.availableSeats += row.availableSeats;
        return acc;
      },
      { totalSeats: 0, usedSeats: 0, availableSeats: 0 },
    );

    return { schoolId, totals, owners: rows };
  }

  async assignCourseSeatToUser(
    userId: string,
    data: AssignCourseSeatDto,
    assignedByUserId: string,
    assignedByRole: string,
  ): Promise<{ success: boolean; quota?: OwnerSeatQuotaResult }> {
    const { schoolId, courseId, ownerId } = data;

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(schoolId)) {
      throw new BadRequestException('Invalid school ID');
    }
    if (!Types.ObjectId.isValid(courseId)) {
      throw new BadRequestException('Invalid course ID');
    }

    const [targetUser, school, course, assigner] = await Promise.all([
      this.userModel.findById(userId),
      this.schoolModel.findById(schoolId),
      this.courseModel.findById(courseId),
      this.userModel.findById(assignedByUserId),
    ]);

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    if (!school) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
    }
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    if (!assigner) {
      throw new NotFoundException(
        `Assigning user with ID ${assignedByUserId} not found`,
      );
    }

    if (course.school.toString() !== schoolId) {
      throw new BadRequestException('Course does not belong to the school');
    }

    const normalizedRole = String(assignedByRole || '').toLowerCase();
    const isSuperAdmin =
      normalizedRole === UserRole.SUPER_ADMIN ||
      normalizedRole === UserRole.ADMIN;
    const isOwner = normalizedRole === UserRole.SCHOOL_OWNER;
    const isAdministrative = normalizedRole === UserRole.ADMINISTRATIVE;

    if (!isSuperAdmin && !isOwner && !isAdministrative) {
      throw new ForbiddenException(
        'Only super_admin, admin, school_owner and administrative can assign course seats',
      );
    }

    if (isOwner || isAdministrative) {
      const canManage = await this.canManageSchool(assignedByUserId, schoolId);
      if (!canManage) {
        throw new ForbiddenException('You do not have access to this school');
      }
    }

    const quotaOwnerId = await this.resolveQuotaOwnerId(
      schoolId,
      assigner,
      normalizedRole,
      ownerId,
    );

    const targetDoc = targetUser as any;
    if (!Array.isArray(targetDoc.courseSeatGrants)) {
      targetDoc.courseSeatGrants = [];
    }

    const activeGrant = targetDoc.courseSeatGrants.find(
      (grant) =>
        grant.isActive === true &&
        grant.schoolId?.toString() === schoolId &&
        grant.courseId?.toString() === courseId,
    );

    if (activeGrant) {
      activeGrant.assignedBy = new Types.ObjectId(assignedByUserId);
      activeGrant.quotaOwnerId = new Types.ObjectId(quotaOwnerId);
      activeGrant.assignedAt = new Date();
      targetUser.markModified('courseSeatGrants');
      await targetUser.save();

      const response: { success: boolean; quota?: OwnerSeatQuotaResult } = {
        success: true,
      };
      response.quota = await this.getOwnerSeatQuota(quotaOwnerId, schoolId);
      return response;
    }

    const ownerQuota = await this.getOwnerSeatQuota(quotaOwnerId, schoolId);
    if (ownerQuota.availableSeats <= 0) {
      throw new BadRequestException(
        'Cumpliste tu cuota de cupos para esta escuela.',
      );
    }

    targetDoc.courseSeatGrants.push({
      schoolId: new Types.ObjectId(schoolId),
      courseId: new Types.ObjectId(courseId),
      assignedBy: new Types.ObjectId(assignedByUserId),
      quotaOwnerId: new Types.ObjectId(quotaOwnerId),
      isActive: true,
      isConsumed: false,
      assignedAt: new Date(),
      consumedAt: undefined,
      releasedAt: undefined,
    });

    if (!targetUser.schools?.some((id) => id.toString() === schoolId)) {
      targetUser.schools = targetUser.schools || [];
      targetUser.schools.push(new Types.ObjectId(schoolId) as any);
    }

    await targetUser.save();

    const response: { success: boolean; quota?: OwnerSeatQuotaResult } = {
      success: true,
    };
    response.quota = await this.getOwnerSeatQuota(quotaOwnerId, schoolId);

    return response;
  }

  async revokeCourseSeatFromUser(
    userId: string,
    schoolId: string,
    courseId: string,
    revokedByUserId: string,
    revokedByRole: string,
  ): Promise<{ success: boolean; quota?: OwnerSeatQuotaResult }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }
    if (!Types.ObjectId.isValid(schoolId)) {
      throw new BadRequestException('Invalid school ID');
    }
    if (!Types.ObjectId.isValid(courseId)) {
      throw new BadRequestException('Invalid course ID');
    }

    const [targetUser, course, revoker] = await Promise.all([
      this.userModel.findById(userId),
      this.courseModel.findById(courseId),
      this.userModel.findById(revokedByUserId),
    ]);

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    if (!revoker) {
      throw new NotFoundException(
        `Revoking user with ID ${revokedByUserId} not found`,
      );
    }
    if (course.school.toString() !== schoolId) {
      throw new BadRequestException('Course does not belong to the school');
    }

    const normalizedRole = String(revokedByRole || '').toLowerCase();
    const isSuperAdmin =
      normalizedRole === UserRole.SUPER_ADMIN ||
      normalizedRole === UserRole.ADMIN;
    const isOwner = normalizedRole === UserRole.SCHOOL_OWNER;
    const isAdministrative = normalizedRole === UserRole.ADMINISTRATIVE;

    if (!isSuperAdmin && !isOwner && !isAdministrative) {
      throw new ForbiddenException(
        'Only super_admin, admin, school_owner and administrative can revoke course seats',
      );
    }

    if (isOwner || isAdministrative) {
      const canManage = await this.canManageSchool(revokedByUserId, schoolId);
      if (!canManage) {
        throw new ForbiddenException('You do not have access to this school');
      }
    }

    const targetDoc = targetUser as any;
    if (!Array.isArray(targetDoc.courseSeatGrants)) {
      targetDoc.courseSeatGrants = [];
    }

    const activeGrant = targetDoc.courseSeatGrants.find(
      (grant) =>
        grant.isActive === true &&
        grant.schoolId?.toString() === schoolId &&
        grant.courseId?.toString() === courseId,
    );

    if (!activeGrant) {
      return { success: true };
    }

    const quotaOwnerId =
      activeGrant.quotaOwnerId?.toString() ||
      activeGrant.assignedBy?.toString() ||
      '';

    if (isOwner && quotaOwnerId && quotaOwnerId !== revokedByUserId) {
      throw new ForbiddenException(
        'School owners can only revoke seats from their own quota',
      );
    }

    activeGrant.isActive = false;
    activeGrant.revokedAt = new Date();
    if (activeGrant.isConsumed) {
      activeGrant.isConsumed = false;
      activeGrant.releasedAt = new Date();
    }

    targetUser.markModified('courseSeatGrants');
    await targetUser.save();

    const response: { success: boolean; quota?: OwnerSeatQuotaResult } = {
      success: true,
    };
    if (quotaOwnerId && Types.ObjectId.isValid(quotaOwnerId)) {
      response.quota = await this.getOwnerSeatQuota(quotaOwnerId, schoolId);
    }

    return response;
  }

  async hasActiveCourseSeat(
    userId: string,
    schoolId: string,
    courseId: string,
  ): Promise<boolean> {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(schoolId) ||
      !Types.ObjectId.isValid(courseId)
    ) {
      return false;
    }

    const user = await this.userModel
      .findById(userId)
      .select('courseSeatGrants')
      .exec();
    if (!user) return false;

    const grants = (user as any).courseSeatGrants || [];
    return grants.some(
      (grant) =>
        grant.isActive === true &&
        grant.schoolId?.toString() === schoolId &&
        grant.courseId?.toString() === courseId,
    );
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
    options?: { requireCurrentPassword?: boolean },
  ): Promise<User> {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const storedPasswordHash =
      typeof user.password === 'string' ? user.password.trim() : '';
    const hasLocalPassword = storedPasswordHash.length > 0;

    // Only verify current password if it's provided
    if (changePasswordDto.currentPassword) {
      if (!hasLocalPassword) {
        throw new BadRequestException(
          'Esta cuenta aún no tiene una contraseña local configurada',
        );
      }

      // Verify current password
      const isPasswordValid = await argon2.verify(
        storedPasswordHash,
        changePasswordDto.currentPassword,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('La contraseña actual es incorrecta');
      }

      // Check if new password is the same as the current one
      if (changePasswordDto.currentPassword === changePasswordDto.newPassword) {
        throw new BadRequestException(
          'La nueva contraseña debe ser diferente a la actual',
        );
      }
    }

    if (
      options?.requireCurrentPassword &&
      !changePasswordDto.currentPassword &&
      hasLocalPassword
    ) {
      throw new BadRequestException('Current password is required');
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

  async assignSchoolRoleForManager(
    userId: string,
    schoolId: string,
    role: string,
    authUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!schoolId) {
      throw new BadRequestException('El ID de la escuela es obligatorio');
    }
    if (!role) {
      throw new BadRequestException('El rol es obligatorio');
    }

    const allowedRoles = [
      UserRole.TEACHER,
      UserRole.ADMINISTRATIVE,
      UserRole.STUDENT,
    ];
    const normalizedRole = String(role).toLowerCase();
    if (!allowedRoles.includes(normalizedRole as UserRole)) {
      throw new BadRequestException(
        `Rol inválido. Los roles permitidos son: ${allowedRoles.join(', ')}`,
      );
    }

    const canManage = await this.authorizationService.canManageUserInSchool(
      authUserId,
      userId,
      schoolId,
    );
    if (!canManage) {
      throw new ForbiddenException(
        'No tiene permisos para asignar este rol en esta escuela',
      );
    }

    const success = await this.authorizationService.assignRoleInSchool(
      userId,
      schoolId,
      normalizedRole,
    );
    if (!success) {
      throw new ForbiddenException(
        'No se pudo asignar el rol al usuario en la escuela',
      );
    }

    return {
      success: true,
      message: `Rol ${normalizedRole} asignado correctamente al usuario en la escuela`,
    };
  }

  async registerUnregisteredUserByManager(
    userId: string,
    registerData: RegisterUnregisteredUserDto,
  ): Promise<{ success: boolean; message: string; user: User }> {
    const user = await this.convertUnregisteredToRegistered(
      userId,
      registerData,
    );

    return {
      success: true,
      message: 'Usuario registrado correctamente',
      user,
    };
  }

  async createUnregisteredUserFromPayload(data: {
    name: string;
    courseId?: string;
    schoolId?: string;
  }): Promise<User> {
    if (!data?.name) {
      throw new BadRequestException(
        'El nombre es requerido para crear un asistente',
      );
    }

    return this.createUnregisteredUser(
      data.name,
      data.courseId || undefined,
      data.schoolId || undefined,
    );
  }

  async createAssistantTestRecord(body: any): Promise<any> {
    const userCollection = this.userModel.collection;
    const timestamp = Date.now();
    const uniqueEmail = `asistente.${timestamp}@temp.local`;

    const userDocument: any = {
      name: body.name || 'Test Assistant',
      email: uniqueEmail,
      role: UserRole.UNREGISTERED,
      isActive: true,
      enrolledCourses: [],
      schools: [],
      schoolRoles: [],
      createdAt: new Date(),
    };

    const result = await userCollection.insertOne(userDocument);

    return {
      success: true,
      message: 'Test asistente creado exitosamente',
      id: result.insertedId,
      document: userDocument,
    };
  }

  async assignRoleInSchoolForRequester(
    userId: string,
    schoolId: string,
    role: string,
    requestUserId: string,
    requestUserRole: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID de usuario inválido');
    }
    if (!Types.ObjectId.isValid(schoolId)) {
      throw new BadRequestException('ID de escuela inválido');
    }

    const validRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SCHOOL_OWNER,
      UserRole.TEACHER,
      UserRole.STUDENT,
      UserRole.ADMINISTRATIVE,
      UserRole.UNREGISTERED,
    ];
    const normalizedRole = String(role || '').toLowerCase();
    if (!validRoles.includes(normalizedRole as UserRole)) {
      throw new BadRequestException(
        `Rol inválido. Roles permitidos: ${validRoles.join(', ')}`,
      );
    }

    const normalizedRequesterRole = String(requestUserRole || '').toLowerCase();

    if (
      [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(
        normalizedRole as UserRole,
      ) &&
      normalizedRequesterRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Solo super administradores pueden asignar estos roles',
      );
    }

    if (normalizedRole === UserRole.SCHOOL_OWNER) {
      if (
        ![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(
          normalizedRequesterRole as UserRole,
        )
      ) {
        const isSchoolOwner = await this.authorizationService.isSchoolOwner(
          requestUserId,
          schoolId,
        );
        if (!isSchoolOwner) {
          throw new ForbiddenException(
            'Solo administradores o dueños de escuela pueden asignar este rol',
          );
        }
      }
    }

    const canManage = await this.authorizationService.canManageUserInSchool(
      requestUserId,
      userId,
      schoolId,
    );
    if (!canManage && normalizedRequesterRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'No tiene permisos para asignar roles en esta escuela',
      );
    }

    const success = await this.authorizationService.assignRoleInSchool(
      userId,
      schoolId,
      normalizedRole,
    );
    if (!success) {
      throw new BadRequestException(
        'No se pudo asignar el rol en la escuela',
      );
    }

    return {
      success: true,
      message: `Rol ${normalizedRole} asignado correctamente en la escuela`,
    };
  }

  async removeRoleInSchoolForRequester(
    userId: string,
    schoolId: string,
    role: string,
    requestUserId: string,
    requestUserRole: string,
  ): Promise<{ success: boolean; message: string; user: User }> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    if (!role) {
      throw new BadRequestException('role is required');
    }

    const normalizedRequesterRole = String(requestUserRole || '').toLowerCase();
    if (
      normalizedRequesterRole !== UserRole.SUPER_ADMIN &&
      normalizedRequesterRole !== UserRole.ADMIN
    ) {
      const canManage = await this.authorizationService.canManageUserInSchool(
        requestUserId,
        userId,
        schoolId,
      );
      if (!canManage) {
        throw new ForbiddenException(
          'No tiene permisos para quitar roles en esta escuela',
        );
      }
    }

    const updatedUser = await this.removeRoleInSchool(userId, schoolId, role);
    return {
      success: true,
      message: `Rol ${role} removido de la escuela`,
      user: updatedUser,
    };
  }

  async getOwnerSeatQuotaForRequester(
    ownerId: string,
    schoolId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<{ success: boolean; quota: OwnerSeatQuotaResult }> {
    if (!schoolId) {
      throw new BadRequestException('schoolId query param is required');
    }

    const normalizedRole = String(requesterRole || '').toLowerCase();
    if (normalizedRole === UserRole.SCHOOL_OWNER && requesterId !== ownerId) {
      throw new ForbiddenException(
        'School owners can only read their own quota',
      );
    }

    const quota = await this.getOwnerSeatQuota(ownerId, schoolId);
    return { success: true, quota };
  }

  async getOwnerSeatQuotaReportForRequester(
    schoolId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<any> {
    if (!schoolId) {
      throw new BadRequestException('schoolId query param is required');
    }

    const result = await this.getOwnerSeatQuotaReportBySchool(
      schoolId,
      requesterId,
      requesterRole,
    );

    return { success: true, ...result };
  }

  async assignCourseSeatForRequester(
    userId: string,
    data: AssignCourseSeatDto,
    assignedByUserId: string,
    assignedByRole: string,
  ): Promise<any> {
    if (!data?.schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    if (!data?.courseId) {
      throw new BadRequestException('courseId is required');
    }

    const result = await this.assignCourseSeatToUser(
      userId,
      data,
      assignedByUserId,
      assignedByRole,
    );

    return {
      success: true,
      message: 'Course seat assigned successfully',
      ...result,
    };
  }

  async revokeCourseSeatForRequester(
    userId: string,
    schoolId: string,
    courseId: string,
    revokedByUserId: string,
    revokedByRole: string,
  ): Promise<any> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }

    const result = await this.revokeCourseSeatFromUser(
      userId,
      schoolId,
      courseId,
      revokedByUserId,
      revokedByRole,
    );

    return {
      success: true,
      message: 'Course seat revoked successfully',
      ...result,
    };
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

    const normalizedStatus = String(status || '').toLowerCase();
    if (normalizedStatus === 'active') {
      user.isActive = true;
    } else if (
      normalizedStatus === 'inactive' ||
      normalizedStatus === 'suspended'
    ) {
      user.isActive = false;
    }

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
