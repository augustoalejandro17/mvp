import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, Logger, Query, Delete, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { Permission, RequirePermissions, PermissionsGuard } from '../auth/guards/permissions.guard';
import { getUserIdFromRequest, getUserRoleFromRequest } from '../utils/token-handler';

type ServiceUserRole = any; // Usamos any para evitar los errores de tipo

@Controller('courses')
export class CoursesController {
  private readonly logger = new Logger(CoursesController.name);

  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req, @Query('schoolId') schoolId?: string) {
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    
    this.logger.log(`Processing request to get all courses${schoolId ? ` from school ${schoolId}` : ''}`);
    this.logger.log(`User: ${userId}, Role: ${userRole}`);
    
    return this.coursesService.findAll(userId, userRole, schoolId);
  }

  @Get('teaching')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async getTeachingCourses(@Req() req) {
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    
    this.logger.log(`Processing request to get courses taught by user: ${userId}`);
    this.logger.log(`User: ${userId}, Role: ${userRole}`);
    
    return this.coursesService.getTeachingCourses(userId, userRole);
  }

  @Get('enrolled')
  @UseGuards(JwtAuthGuard)
  async getEnrolledCourses(@Req() req) {
    const userId = getUserIdFromRequest(req);
    
    this.logger.log(`Processing request to get courses enrolled by user: ${userId}`);
    
    return this.coursesService.getEnrolledCourses(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req) {
    const userId = getUserIdFromRequest(req);
    
    this.logger.log(`Processing request to get course with ID: ${id}`);
    this.logger.log(`User: ${userId}, Role: ${req.user.role}`);
    
    return this.coursesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async create(@Body() createCourseDto: CreateCourseDto, @Req() req) {
    const userId = getUserIdFromRequest(req);
    
    this.logger.log(`Processing course creation request: ${JSON.stringify(createCourseDto)}`);
    this.logger.log(`User: ${userId}, Role: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.create(createCourseDto, userId);
      
      let courseId = 'Unknown ID';
      try {
        if (result) {
          courseId = result.toString();
        }
      } catch (err) {
        this.logger.error(`Error extracting course ID: ${err.message}`);
      }
      
      this.logger.log(`Course created successfully: ${courseId}`);
      this.logger.log(`Course created by teacher: ${userId} for school: ${createCourseDto.schoolId}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Error creating course: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateCourseDto: any, @Req() req) {
    const userId = getUserIdFromRequest(req);
    
    this.logger.log(`Processing request to update course with ID: ${id}`);
    this.logger.log(`Authenticated user: ${userId}, Role: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.update(id, updateCourseDto, userId);
      this.logger.log(`Course updated successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error updating course: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/students/:studentId')
  @UseGuards(JwtAuthGuard)
  async addStudent(@Param('id') id: string, @Param('studentId') studentId: string, @Req() req) {
    const userId = getUserIdFromRequest(req);
    
    this.logger.log(`Processing request to add student ${studentId} to course ${id}`);
    this.logger.log(`Authenticated user: ${userId}, Role: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.addStudent(id, studentId, userId);
      this.logger.log(`Student added successfully to course`);
      return result;
    } catch (error) {
      this.logger.error(`Error adding student: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/students/:studentId/remove')
  @UseGuards(JwtAuthGuard)
  async removeStudent(@Param('id') id: string, @Param('studentId') studentId: string, @Req() req) {
    const userId = getUserIdFromRequest(req);
    
    this.logger.log(`Processing request to remove student ${studentId} from course ${id}`);
    this.logger.log(`Authenticated user: ${userId}, Role: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.removeStudent(id, studentId, userId);
      this.logger.log(`Student removed successfully from course`);
      return result;
    } catch (error) {
      this.logger.error(`Error removing student: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req) {
    const userId = getUserIdFromRequest(req);
    
    this.logger.log(`Processing request to delete course with ID: ${id}`);
    this.logger.log(`Authenticated user: ${userId}, Role: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.remove(id, userId);
      this.logger.log(`Course deleted successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Error deleting course: ${error.message}`, error.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CREATE_COURSE, Permission.UPDATE_COURSE)
  @Post(':id/enroll/:studentId')
  async enrollStudent(
    @Param('id') courseId: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    const userId = getUserIdFromRequest(req);
    return this.coursesService.enrollStudent(courseId, studentId, userId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CREATE_COURSE, Permission.UPDATE_COURSE)
  @Put(':id/enrollment/:studentId')
  async updateEnrollmentStatus(
    @Param('id') courseId: string,
    @Param('studentId') studentId: string,
    @Body() updateData: { paymentStatus: boolean; paymentNotes?: string },
    @Req() req,
  ) {
    const userId = getUserIdFromRequest(req);
    return this.coursesService.updateEnrollmentPaymentStatus(
      courseId,
      studentId,
      updateData.paymentStatus,
      updateData.paymentNotes,
      userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('student/:studentId/enrollments')
  async getStudentEnrollments(
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    // Students can only view their own enrollments
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    
    if (userRole === UserRole.STUDENT && userId !== studentId) {
      throw new UnauthorizedException('You can only view your own enrollments');
    }
    
    return this.coursesService.getEnrollmentsByStudent(studentId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_COURSE)
  @Get(':id/enrollments')
  async getCourseEnrollments(
    @Param('id') courseId: string,
  ) {
    return this.coursesService.getEnrollmentsByCourse(courseId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELETE_COURSE)
  @Delete(':id/enroll/:studentId')
  async unenrollStudent(
    @Param('id') courseId: string,
    @Param('studentId') studentId: string,
  ) {
    await this.coursesService.unenrollStudent(courseId, studentId);
    return { message: 'Student unenrolled successfully' };
  }
} 