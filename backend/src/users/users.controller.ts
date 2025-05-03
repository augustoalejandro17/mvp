import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Logger, Req, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChangeRoleDto } from './dto/change-role.dto';
import { UserRole } from '../auth/schemas/user.schema';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Request } from 'express';
import { AuthorizationService } from '../auth/services/authorization.service';
import { Permission, RequirePermissions, PermissionsGuard } from '../auth/guards/permissions.guard';

// DTO para la asignación de roles contextuales
class AssignSchoolRoleDto {
  schoolId: string;
  role: UserRole;
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
  async create(@Body() createUserDto: any): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  @Post('with-courses')
  @UseGuards(JwtAuthGuard)
  async createWithCourses(@Body() data: { user: Partial<User>, courses: string[] }): Promise<User> {
    this.logger.log(`Creando usuario ${data.user.name} con ${data.courses?.length || 0} cursos`);
    return this.usersService.createWithCourses(data.user, data.courses || []);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER)
  update(@Param('id') id: string, @Body() updateUserDto: Partial<User>) {
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
  ): Promise<User> {
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
      this.logger.warn(`User ${userId} attempted to change password for user ${id}`);
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
    this.logger.log(`Asignando rol ${assignRoleDto.role} en escuela ${assignRoleDto.schoolId} al usuario ${userId}`);
    
    const authUserId = req.user['sub'] || req.user['_id'];
    const schoolId = assignRoleDto.schoolId;
    
    // Verificar que el usuario tenga permisos para gestionar este tipo de rol en la escuela
    const canManage = await this.authorizationService.canManageUserInSchool(
      authUserId,
      userId,
      schoolId
    );
    
    if (!canManage) {
      this.logger.warn(`Usuario ${authUserId} sin permisos para asignar rol ${assignRoleDto.role} en escuela ${schoolId}`);
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
} 