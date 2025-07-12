import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Logger,
  Req,
  ForbiddenException,
  BadRequestException,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { User as AuthUser } from '../auth/schemas/user.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Request } from 'express';
import { AuthorizationService } from '../auth/services/authorization.service';
import {
  Permission,
  RequirePermissions,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School } from '../schools/schemas/school.schema';

// DTO para la asignación de roles contextuales
class AssignSchoolRoleDto {
  schoolId: string;
  role: string;
}

// DTO para registrar un usuario no registrado
class RegisterUnregisteredUserDto {
  email: string;
  password: string;
  additionalInfo?: {
    [key: string]: any;
  };
}

// DTO para crear un usuario no registrado
class CreateUnregisteredUserDto {
  name: string;
  schoolId?: string;
  courseId?: string;
  role?: string;
}

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService,
    @InjectModel(School.name) private readonly schoolModel: Model<School>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE)
  findAll(@Req() req: Request) {
    const userId = req.user['sub'] || req.user['_id'];
    const userRole = req.user['role'];
    this.logger.log(
      `User ${userId} with role ${userRole} is requesting all users`,
    );
    return this.usersService.findAll(userId, userRole);
  }

  @Get('search-by-email')
  @UseGuards(JwtAuthGuard)
  async searchUsersByEmail(
    @Query('email') email: string,
    @Req() req: Request,
    @Query('schoolId') schoolId?: string,
  ) {
    this.logger.log(`Buscando usuarios con email similar a: ${email}`);
    const userId = req.user['sub'] || req.user['_id'];
    const userRole = req.user['role'];

    return this.usersService.searchUsersByEmail(
      email,
      userId,
      userRole,
      schoolId,
    );
  }

  @Get('by-role/:role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async findByRole(@Param('role') role: UserRole) {
    this.logger.log(`Buscando usuarios con rol: ${role}`);
    return this.usersService.findByRole(role);
  }

  @Get('unregistered')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async findUnregistered(@Req() req: Request) {
    const userId = req.user['sub'] || req.user['_id'];
    const userRole = req.user['role'];
    return this.usersService.findUnregistered(userId, userRole);
  }

  @Get('teachers-by-school/:schoolId')
  @UseGuards(JwtAuthGuard)
  async findTeachersBySchool(@Param('schoolId') schoolId: string) {
    this.logger.log(`Buscando profesores para la escuela: ${schoolId}`);
    return this.usersService.findTeachersBySchool(schoolId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.ADMIN,
  )
  async create(@Body() createUserDto: any): Promise<AuthUser> {
    return this.usersService.create(createUserDto);
  }

  @Post('with-courses')
  @UseGuards(JwtAuthGuard)
  async createWithCourses(
    @Body() data: { user: Partial<AuthUser>; courses: string[] },
  ): Promise<AuthUser> {
    return this.usersService.createWithCourses(data.user, data.courses || []);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE)
  update(@Param('id') id: string, @Body() updateUserDto: Partial<AuthUser>) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async changeRole(
    @Param('id') id: string,
    @Body() changeRoleDto: ChangeRoleDto,
  ): Promise<AuthUser> {
    return this.usersService.changeRole(id, changeRoleDto.role);
  }

  @Patch(':id/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    // Ensure users can only change their own password
    const userId = req.user['sub'];
    if (id !== userId) {
      throw new ForbiddenException('You can only change your own password');
    }

    await this.usersService.changePassword(id, changePasswordDto);
    return { message: 'Password changed successfully' };
  }

  @Patch(':id/admin-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE)
  async adminChangePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    this.logger.log(`Admin changing password for user: ${id}`);
    // Ensure we have a password field in the DTO
    if (!changePasswordDto.password && !changePasswordDto.newPassword) {
      throw new BadRequestException(
        'Either password or newPassword must be provided',
      );
    }
    await this.usersService.changePassword(id, changePasswordDto);
    return { message: 'Password changed successfully by admin' };
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
    @Req() req: Request,
  ) {
    const changedBy = req.user['sub'] || req.user['_id'];
    const { status, reason } = body;

    const user = await this.usersService.updateUserStatus(
      id,
      status,
      changedBy,
      reason,
    );
    return { success: true, user };
  }

  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getUserStats() {
    return this.usersService.getUserStats();
  }

  @Get('with-status/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE)
  findAllWithStatus(
    @Req() req: Request,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const userId = req.user['sub'] || req.user['_id'];
    const userRole = req.user['role'];
    const includeInactiveBoolean = includeInactive === 'true';

    this.logger.log(
      `User ${userId} with role ${userRole} is requesting all users with status filter`,
    );
    return this.usersService.findAllWithStatus(
      includeInactiveBoolean,
      userId,
      userRole,
    );
  }

  /**
   * Asigna un rol específico a un usuario en una escuela
   */
  @Post(':id/school-role')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(
    Permission.MANAGE_ADMINS,
    Permission.MANAGE_TEACHERS,
    Permission.MANAGE_STUDENTS,
  )
  async assignSchoolRole(
    @Param('id') userId: string,
    @Body() assignRoleDto: AssignSchoolRoleDto,
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Intentando asignar rol en escuela: ${JSON.stringify(assignRoleDto)}`,
    );

    // Validación básica de datos
    if (!assignRoleDto.schoolId) {
      throw new BadRequestException('El ID de la escuela es obligatorio');
    }

    if (!assignRoleDto.role) {
      throw new BadRequestException('El rol es obligatorio');
    }

    // Validar que el rol sea uno de los permitidos
    const allowedRoles = ['teacher', 'administrative', 'student'];
    if (!allowedRoles.includes(assignRoleDto.role)) {
      throw new BadRequestException(
        `Rol inválido. Los roles permitidos son: ${allowedRoles.join(', ')}`,
      );
    }

    const authUserId = req.user['sub'] || req.user['_id'];
    const schoolId = assignRoleDto.schoolId;

    // Verificar que el usuario tenga permisos para gestionar este tipo de rol en la escuela
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

    // Pasar el rol como string al servicio
    const success = await this.authorizationService.assignRoleInSchool(
      userId,
      schoolId,
      assignRoleDto.role, // esto ahora es un string, no un UserRole
    );

    if (success) {
      return {
        success: true,
        message: `Rol ${assignRoleDto.role} asignado correctamente al usuario en la escuela`,
      };
    } else {
      throw new ForbiddenException(
        'No se pudo asignar el rol al usuario en la escuela',
      );
    }
  }

  /**
   * Convierte un usuario no registrado (asistente) en un usuario registrado con email y password
   */
  @Post(':id/register')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STUDENTS)
  async registerUnregisteredUser(
    @Param('id') userId: string,
    @Body() registerDto: RegisterUnregisteredUserDto,
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string; user: AuthUser }> {
    const authUserId = req.user['sub'] || req.user['_id'];

    // Verificar que el usuario tenga permisos para realizar esta acción
    // Aquí deberías implementar alguna validación adicional si es necesario

    try {
      const user = await this.usersService.convertUnregisteredToRegistered(
        userId,
        registerDto,
      );

      return {
        success: true,
        message: 'Usuario registrado correctamente',
        user,
      };
    } catch (error) {
      this.logger.error(
        `Error al registrar usuario no registrado: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Crea un usuario no registrado (asistente) directamente
   */
  @Post('unregistered')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STUDENTS)
  async createUnregisteredUser(
    @Body() createDto: CreateUnregisteredUserDto,
    @Req() req: Request,
  ): Promise<any> {
    // Log detallado para depurar

    // Validar datos mínimos
    if (!createDto.name) {
      this.logger.error('Error: Nombre es requerido para crear un asistente');
      throw new BadRequestException(
        'El nombre es requerido para crear un asistente',
      );
    }

    try {
      // Extraer cada campo individualmente para mayor claridad
      const name = createDto.name;
      const courseId = createDto.courseId || undefined;
      const schoolId = createDto.schoolId || undefined;

      // Crear directamente un usuario con rol UNREGISTERED
      const user = await this.usersService.createUnregisteredUser(
        name,
        courseId,
        schoolId,
      );

      return user;
    } catch (error) {
      this.logger.error(
        `Error al crear asistente: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Error al crear asistente: ${error.message}`,
      );
    }
  }

  /**
   * Endpoint de prueba para diagnosticar problemas con la creación de asistentes
   */
  @Post('test-assistant')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STUDENTS)
  async testCreateAssistant(
    @Body() body: any,
    @Req() req: Request,
  ): Promise<any> {
    try {
      // Acceso directo a la colección de MongoDB sin Mongoose
      const userCollection = this.usersService['userModel'].collection;

      // Generar un email único para cada asistente usando timestamp
      const timestamp = Date.now();
      const uniqueEmail = `asistente.${timestamp}@temp.local`;

      // Documento con email único
      const userDocument: any = {
        name: body.name || 'Test Assistant',
        email: uniqueEmail, // Asignar email único para evitar duplicados
        role: 'unregistered',
        isActive: true,
        enrolledCourses: [],
        schools: [],
        schoolRoles: [],
        createdAt: new Date(),
      };

      // Insertar directamente en MongoDB
      const result = await userCollection.insertOne(userDocument);

      return {
        success: true,
        message: 'Test asistente creado exitosamente',
        id: result.insertedId,
        document: userDocument,
      };
    } catch (error) {
      this.logger.error(
        `Error en prueba de creación: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * Crea un asistente directamente sin usar DTO (bypass)
   */
  @Post('bypass-assistant')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async createAssistantBypass(
    @Req() req: Request,
    @Body() rawData: any,
  ): Promise<any> {
    try {
      const name = rawData.name;
      const courseId = rawData.courseId;
      const schoolId = rawData.schoolId;

      if (!name) {
        throw new BadRequestException('El nombre es obligatorio');
      }

      // Usar el servicio directamente
      const user = await this.usersService.createUnregisteredUser(
        name,
        courseId,
        schoolId,
      );

      return user;
    } catch (error) {
      this.logger.error(`Error bypass: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Error al crear asistente: ${error.message}`,
      );
    }
  }

  /**
   * Asigna un rol en una escuela específica a un usuario
   */
  @Post(':id/assign-role-in-school')
  @UseGuards(JwtAuthGuard)
  async assignRoleInSchool(
    @Param('id') userId: string,
    @Body() body: { schoolId: string; role: string },
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Asignando rol ${body.role} en escuela ${body.schoolId} al usuario ${userId}`,
    );

    try {
      // Validar el ID del usuario
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('ID de usuario inválido');
      }

      // Validar el ID de la escuela
      if (!Types.ObjectId.isValid(body.schoolId)) {
        throw new BadRequestException('ID de escuela inválido');
      }

      // Verificar que el rol es válido
      const validRoles = [
        'super_admin',
        'admin',
        'school_owner',
        'teacher',
        'student',
        'administrative',
        'unregistered',
      ];

      // Normalizar el rol a minúsculas para la comparación
      const normalizedRole = body.role.toLowerCase();

      if (!validRoles.includes(normalizedRole)) {
        throw new BadRequestException(
          `Rol inválido. Roles permitidos: ${validRoles.join(', ')}`,
        );
      }

      // Obtener el ID del usuario que hace la solicitud
      const requestUserId = req.user['sub'] || req.user['_id'];
      const requestUserRole = String(req.user['role']).toLowerCase();

      this.logger.log(
        `Usuario solicitante: ${requestUserId}, rol: ${requestUserRole}`,
      );

      // Solo super_admin puede asignar roles super_admin y admin
      if (
        ['super_admin', 'admin'].includes(normalizedRole) &&
        requestUserRole !== 'super_admin'
      ) {
        throw new ForbiddenException(
          'Solo super administradores pueden asignar estos roles',
        );
      }

      // School_owner solo puede ser asignado por super_admin, admin, o school_owner de la misma escuela
      if (normalizedRole === 'school_owner') {
        // Super admin y admin pueden asignar school_owner a cualquier escuela
        if (!['super_admin', 'admin'].includes(requestUserRole)) {
          // Si no es super_admin ni admin, verificar si es school_owner de esta escuela
          const isSchoolOwner = await this.authorizationService.isSchoolOwner(
            requestUserId,
            body.schoolId,
          );
          if (!isSchoolOwner) {
        throw new ForbiddenException(
              'Solo administradores o dueños de escuela pueden asignar este rol',
        );
          }
        }
      }

      // Verificar que el usuario tiene permisos para gestionar esta escuela
      const canManage = await this.authorizationService.canManageUserInSchool(
        requestUserId,
        userId,
        body.schoolId,
      );

      if (!canManage && requestUserRole !== 'super_admin') {
        throw new ForbiddenException(
          'No tiene permisos para asignar roles en esta escuela',
        );
      }

      // Asignar el rol
      const success = await this.authorizationService.assignRoleInSchool(
        userId,
        body.schoolId,
        body.role,
      );

      if (success) {
        return {
          success: true,
          message: `Rol ${body.role} asignado correctamente en la escuela`,
        };
      } else {
        throw new BadRequestException(
          'No se pudo asignar el rol en la escuela',
        );
      }
    } catch (error) {
      this.logger.error(`Error al asignar rol: ${error.message}`, error.stack);
      throw error;
    }
  }
}
