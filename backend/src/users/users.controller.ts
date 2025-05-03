import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Logger, Req, ForbiddenException, BadRequestException } from '@nestjs/common';
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
import { Permission, RequirePermissions, PermissionsGuard } from '../auth/guards/permissions.guard';

// DTO para la asignación de roles contextuales
class AssignSchoolRoleDto {
  schoolId: string;
  role: UserRole;
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
    private readonly authorizationService: AuthorizationService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER)
  async create(@Body() createUserDto: any): Promise<AuthUser> {
    return this.usersService.create(createUserDto);
  }

  @Post('with-courses')
  @UseGuards(JwtAuthGuard)
  async createWithCourses(@Body() data: { user: Partial<AuthUser>, courses: string[] }): Promise<AuthUser> {
    
    return this.usersService.createWithCourses(data.user, data.courses || []);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER)
  update(@Param('id') id: string, @Body() updateUserDto: Partial<AuthUser>) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER)
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

  /**
   * Asigna un rol específico a un usuario en una escuela
   */
  @Post(':id/school-role')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_ADMINS, Permission.MANAGE_TEACHERS, Permission.MANAGE_STUDENTS)
  async assignSchoolRole(
    @Param('id') userId: string,
    @Body() assignRoleDto: AssignSchoolRoleDto,
    @Req() req: Request,
  ): Promise<{ success: boolean, message: string }> {
    
    
    const authUserId = req.user['sub'] || req.user['_id'];
    const schoolId = assignRoleDto.schoolId;
    
    // Verificar que el usuario tenga permisos para gestionar este tipo de rol en la escuela
    const canManage = await this.authorizationService.canManageUserInSchool(
      authUserId,
      userId,
      schoolId
    );
    
    if (!canManage) {
      
      throw new ForbiddenException('No tiene permisos para asignar este rol en esta escuela');
    }
    
    const success = await this.authorizationService.assignRoleInSchool(
      userId,
      schoolId,
      assignRoleDto.role
    );
    
    if (success) {
      return { 
        success: true, 
        message: `Rol ${assignRoleDto.role} asignado correctamente al usuario en la escuela`
      };
    } else {
      throw new ForbiddenException('No se pudo asignar el rol al usuario en la escuela');
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
  ): Promise<{ success: boolean, message: string, user: AuthUser }> {
    
    
    const authUserId = req.user['sub'] || req.user['_id'];
    
    // Verificar que el usuario tenga permisos para realizar esta acción
    // Aquí deberías implementar alguna validación adicional si es necesario
    
    try {
      const user = await this.usersService.convertUnregisteredToRegistered(userId, registerDto);
      
      return { 
        success: true, 
        message: 'Usuario registrado correctamente',
        user
      };
    } catch (error) {
      this.logger.error(`Error al registrar usuario no registrado: ${error.message}`);
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
      throw new BadRequestException('El nombre es requerido para crear un asistente');
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
        schoolId
      );
      
      
      return user;
    } catch (error) {
      this.logger.error(`Error al crear asistente: ${error.message}`, error.stack);
      throw new BadRequestException(`Error al crear asistente: ${error.message}`);
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
        createdAt: new Date()
      };
      
      // Insertar directamente en MongoDB
      const result = await userCollection.insertOne(userDocument);
      
      
      return { 
        success: true, 
        message: 'Test asistente creado exitosamente',
        id: result.insertedId,
        document: userDocument
      };
    } catch (error) {
      this.logger.error(`Error en prueba de creación: ${error.message}`, error.stack);
      return { 
        success: false, 
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Crea un asistente directamente sin usar DTO (bypass)
   */
  @Post('bypass-assistant')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STUDENTS)
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
      const user = await this.usersService.createUnregisteredUser(name, courseId, schoolId);
      
      return user;
    } catch (error) {
      this.logger.error(`Error bypass: ${error.message}`, error.stack);
      throw new BadRequestException(`Error al crear asistente: ${error.message}`);
    }
  }
} 