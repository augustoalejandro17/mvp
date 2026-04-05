import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  Delete,
  Request,
} from '@nestjs/common';
import { CreateSchoolDto } from './dto/create-school.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import {
  Permission,
  RequirePermissions,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { SchoolsFacade } from './services/schools.facade';

@Controller('schools')
export class SchoolsController {
  constructor(
    private readonly schoolsFacade: SchoolsFacade,
  ) {}

  @Get('public')
  async findPublic() {
    return this.schoolsFacade.findPublic();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req) {
    return this.schoolsFacade.findAllForUser(req.user);
  }

  @Get('teacher/:id')
  @UseGuards(JwtAuthGuard)
  async findByTeacher(@Param('id') id: string) {
    return this.schoolsFacade.findByTeacher(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.schoolsFacade.findOneForRequest(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CREATE_SCHOOL)
  async create(@Body() createSchoolDto: CreateSchoolDto, @Req() req) {
    return this.schoolsFacade.createForRequest(
      createSchoolDto,
      req.user,
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.UPDATE_SCHOOL)
  async update(
    @Param('id') id: string,
    @Body() updateSchoolDto: any,
    @Req() req,
  ) {
    return this.schoolsFacade.updateForRequest(
      id,
      updateSchoolDto,
      req.user,
    );
  }

  @Post(':id/teachers/:teacherId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_TEACHERS)
  async addTeacher(
    @Param('id') id: string,
    @Param('teacherId') teacherId: string,
    @Req() req,
  ) {
    return this.schoolsFacade.addTeacherForRequest(
      id,
      teacherId,
      req.user,
    );
  }

  @Post(':id/students/:studentId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STUDENTS)
  async addStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    return this.schoolsFacade.addStudentForRequest(
      id,
      studentId,
      req.user,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELETE_SCHOOL)
  async remove(@Param('id') id: string, @Req() req) {
    return this.schoolsFacade.removeForRequest(id, req.user);
  }

  @Post(':id/owner/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async assignOwner(@Param('id') id: string, @Param('userId') userId: string) {
    return this.schoolsFacade.assignOwner(id, userId);
  }

  @Get(':id/teachers')
  @UseGuards(JwtAuthGuard)
  async getTeachersBySchool(@Param('id') id: string) {
    return this.schoolsFacade.getTeachersBySchoolForRequest(id);
  }

  @Post('admin/fix-extra-seats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async fixExtraSeats() {
    return this.schoolsFacade.fixExtraSeats();
  }
}

@Controller('users/:userId/owned-schools')
@UseGuards(JwtAuthGuard)
export class UserOwnedSchoolsController {
  constructor(
    private readonly schoolsFacade: SchoolsFacade,
  ) {}

  @Get()
  async getUserOwnedSchools(@Param('userId') userId: string, @Request() req) {
    return this.schoolsFacade.getUserOwnedSchools(userId, req.user);
  }
}

@Controller('users/:userId/administered-schools')
@UseGuards(JwtAuthGuard)
export class UserAdministeredSchoolsController {
  constructor(
    private readonly schoolsFacade: SchoolsFacade,
  ) {}

  @Get()
  async getUserAdministeredSchools(
    @Param('userId') userId: string,
    @Request() req,
  ) {
    return this.schoolsFacade.getUserAdministeredSchools(
      userId,
      req.user,
    );
  }
}
