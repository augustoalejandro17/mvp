import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  Delete,
} from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import {
  Permission,
  RequirePermissions,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CoursesFacade } from './services/courses.facade';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesFacade: CoursesFacade,
  ) {}

  @Get('/seats/policy')
  @UseGuards(JwtAuthGuard)
  async getSeatPolicy(
    @Req() req,
    @Query('schoolId') schoolId?: string,
    @Query('courseId') courseId?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.coursesFacade.getSeatPolicy(req, {
      schoolId,
      courseId,
      ownerId,
    });
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(@Req() req, @Query('schoolId') schoolId?: string) {
    return this.coursesFacade.findAll(req, schoolId);
  }

  @Get('teaching')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async getTeachingCourses(@Req() req) {
    return this.coursesFacade.getTeachingCourses(req);
  }

  @Get('enrolled')
  @UseGuards(JwtAuthGuard)
  async getEnrolledCourses(@Req() req, @Query('userId') targetUserId?: string) {
    return this.coursesFacade.getEnrolledCourses(req, targetUserId);
  }

  @Get('public/enrolled/:userId')
  async getPublicEnrolledCourses(@Param('userId') userId: string) {
    return this.coursesFacade.getPublicEnrolledCourses(userId);
  }

  @Get('public/teaching/:userId')
  async getPublicTeachingCourses(@Param('userId') userId: string) {
    return this.coursesFacade.getPublicTeachingCourses(userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @Req() req,
    @Query('includeSchedule') includeSchedule?: string,
  ) {
    return this.coursesFacade.findOne(req, id, includeSchedule);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVE,
    UserRole.SCHOOL_OWNER,
    UserRole.SUPER_ADMIN,
  )
  async create(@Body() createCourseDto: CreateCourseDto, @Req() req) {
    return this.coursesFacade.create(req, createCourseDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Req() req,
  ) {
    return this.coursesFacade.update(req, id, updateCourseDto);
  }

  @Post(':id/students/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.TEACHER,
  )
  async addStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    return this.coursesFacade.addStudent(req, id, studentId);
  }

  @Post(':id/enroll/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.TEACHER,
  )
  async enrollStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    return this.coursesFacade.enrollStudent(req, id, studentId);
  }

  @Post(':id/unenroll/:studentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.TEACHER,
  )
  async unenrollStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    return this.coursesFacade.unenrollStudent(req, id, studentId);
  }

  @Post(':id/students/:studentId/remove')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.TEACHER,
  )
  async removeStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    return this.coursesFacade.removeStudent(req, id, studentId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req) {
    return this.coursesFacade.remove(req, id);
  }
}
