import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersFacade } from './services/users.facade';
import { User as AuthUser } from '../auth/schemas/user.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AssignSchoolRoleDto } from './dto/assign-school-role.dto';
import { RegisterUnregisteredUserDto } from './dto/register-unregistered-user.dto';
import { CreateUnregisteredUserDto } from './dto/create-unregistered-user.dto';
import { SetOwnerSeatQuotaDto } from './dto/set-owner-seat-quota.dto';
import { AssignCourseSeatDto } from './dto/assign-course-seat.dto';
import { Request } from 'express';
import {
  Permission,
  RequirePermissions,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly usersFacade: UsersFacade,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.ADMIN,
  )
  findAll(@Req() req: Request) {
    return this.usersFacade.findAll(req);
  }

  @Get('search-by-email')
  @UseGuards(JwtAuthGuard)
  async searchUsersByEmail(
    @Query('email') email: string,
    @Req() req: Request,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.usersFacade.searchUsersByEmail(req, email, schoolId);
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
    return this.usersFacade.findUnregistered(req);
  }

  @Get('teachers-by-school/:schoolId')
  @UseGuards(JwtAuthGuard)
  async findTeachersBySchool(@Param('schoolId') schoolId: string) {
    return this.usersService.findTeachersBySchool(schoolId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.usersFacade.findOne(id, req);
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.ADMIN,
  )
  async createWithCourses(
    @Body() data: { user: Partial<AuthUser>; courses: string[] },
  ): Promise<AuthUser> {
    return this.usersService.createWithCourses(data.user, data.courses || []);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.ADMIN,
  )
  update(@Param('id') id: string, @Body() updateUserDto: Partial<AuthUser>) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteSelf(@Req() req: Request) {
    return this.usersFacade.deleteSelf(req);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.ADMIN,
  )
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
    return this.usersFacade.changePassword(id, changePasswordDto, req);
  }

  @Patch(':id/admin-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.ADMIN,
  )
  async adminChangePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.usersFacade.adminChangePassword(id, changePasswordDto);
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
    return this.usersFacade.updateUserStatus(id, body, req);
  }

  @Get('stats/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getUserStats() {
    return this.usersService.getUserStats();
  }

  @Get('with-status/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.ADMIN,
  )
  findAllWithStatus(
    @Req() req: Request,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.usersFacade.findAllWithStatus(req, includeInactive);
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
    return this.usersFacade.assignSchoolRole(
      userId,
      assignRoleDto,
      req,
    );
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
    return this.usersFacade.registerUnregisteredUser(userId, registerDto);
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
    return this.usersFacade.createUnregisteredUser(createDto);
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
    return this.usersFacade.testCreateAssistant(body);
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
    return this.usersFacade.createAssistantBypass(rawData);
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
    return this.usersFacade.assignRoleInSchool(
      userId,
      body,
      req,
    );
  }

  @Delete(':id/school-role')
  @UseGuards(JwtAuthGuard)
  async removeRoleInSchool(
    @Param('id') userId: string,
    @Query('schoolId') schoolId: string,
    @Query('role') role: string,
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string; user: AuthUser }> {
    return this.usersFacade.removeRoleInSchool(
      userId,
      schoolId,
      role,
      req,
    );
  }

  @Patch(':id/owner-seat-quota')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async setOwnerSeatQuota(
    @Param('id') ownerId: string,
    @Body() body: SetOwnerSeatQuotaDto,
  ): Promise<any> {
    return this.usersFacade.setOwnerSeatQuota(ownerId, body);
  }

  @Get(':id/owner-seat-quota')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async getOwnerSeatQuota(
    @Param('id') ownerId: string,
    @Query('schoolId') schoolId: string,
    @Req() req: Request,
  ): Promise<any> {
    return this.usersFacade.getOwnerSeatQuota(ownerId, schoolId, req);
  }

  @Get('owner-seat-quotas/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async getOwnerSeatQuotaReport(
    @Query('schoolId') schoolId: string,
    @Req() req: Request,
  ): Promise<any> {
    return this.usersFacade.getOwnerSeatQuotaReport(schoolId, req);
  }

  @Post(':id/course-seats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async assignCourseSeat(
    @Param('id') userId: string,
    @Body() body: AssignCourseSeatDto,
    @Req() req: Request,
  ): Promise<any> {
    return this.usersFacade.assignCourseSeat(userId, body, req);
  }

  @Delete(':id/course-seats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async revokeCourseSeat(
    @Param('id') userId: string,
    @Query('schoolId') schoolId: string,
    @Query('courseId') courseId: string,
    @Req() req: Request,
  ): Promise<any> {
    return this.usersFacade.revokeCourseSeat(
      userId,
      schoolId,
      courseId,
      req,
    );
  }
}
