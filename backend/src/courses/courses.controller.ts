import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, Logger, Query, Delete, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { Permission, RequirePermissions, PermissionsGuard } from '../auth/guards/permissions.guard';
import { getUserIdFromRequest, getUserRoleFromRequest } from '../utils/token-handler';
import { PaymentDto } from './dto/payment.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

type ServiceUserRole = any; // Usamos any para evitar los errores de tipo

@Controller('courses')
export class CoursesController {
  private readonly logger = new Logger(CoursesController.name);

  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async findAll(@Req() req, @Query('schoolId') schoolId?: string) {
    let userId = null;
    let userRole = null;
    
    // Si hay token, obtener información del usuario
    if (req.user) {
      userId = getUserIdFromRequest(req);
      userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    }
    
    return this.coursesService.findAll(userId, userRole, schoolId);
  }

  @Get('teaching')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async getTeachingCourses(@Req() req) {
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    
    
    
    
    return this.coursesService.getTeachingCourses(userId, userRole);
  }

  @Get('enrolled')
  @UseGuards(JwtAuthGuard)
  async getEnrolledCourses(@Req() req, @Query('userId') targetUserId?: string) {
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    
    
    
    // Si se especifica un usuario objetivo y es diferente del usuario actual
    if (targetUserId && targetUserId !== userId) {
      
      
      // Verificar si el usuario tiene permiso para ver los cursos de otros (solo admin, school_owner, teacher)
      const isAllowed = 
        userRole === UserRole.SUPER_ADMIN || 
        userRole === UserRole.ADMIN || 
        userRole === UserRole.SCHOOL_OWNER || 
        userRole === UserRole.TEACHER;
        
      if (!isAllowed) {
        throw new UnauthorizedException('No tienes permiso para ver los cursos de otros usuarios');
      }
      
      return this.coursesService.getEnrolledCourses(targetUserId);
    }
    
    // Si no se especifica usuario o es el mismo que el autenticado
    return this.coursesService.getEnrolledCourses(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req) {
    try {
      // Get user information from token if available
      const userId = req.user?.sub;
      const userRole = req.user?.role;
    
      const result = await this.coursesService.getCourseForUser(id, userId, userRole);
      return result;
    } catch (error) {
      this.logger.error(`Error al obtener curso ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async create(@Body() createCourseDto: CreateCourseDto, @Req() req) {
    const userId = getUserIdFromRequest(req);
    
    
    
    
    try {
      // If no teacher is specified, use the current user as the teacher
      if (!createCourseDto.teacher) {
        createCourseDto.teacher = userId;
      }
      
      const result = await this.coursesService.create(createCourseDto, userId);
      
      let courseId = 'Unknown ID';
      try {
        if (result) {
          courseId = result.toString();
        }
      } catch (err) {
        this.logger.error(`Error extracting course ID: ${err.message}`);
      }
      
      
      
      
      return result;
    } catch (error) {
      this.logger.error(`Error creating course: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto, @Req() req) {
    const userId = getUserIdFromRequest(req);
    
    
    
    
    try {
      const result = await this.coursesService.update(id, updateCourseDto, userId);
      
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
    
    
    
    
    try {
      const result = await this.coursesService.addStudent(id, studentId, userId);
      
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
    
    
    
    
    try {
      const result = await this.coursesService.removeStudent(id, studentId, userId);
      
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
    
    
    
    
    try {
      const result = await this.coursesService.remove(id, userId);
      
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
    @Req() req,
  ) {
    const userId = getUserIdFromRequest(req);
    
    
    await this.coursesService.unenrollStudent(courseId, studentId, userId);
    return { message: 'Student unenrolled successfully' };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CREATE_COURSE, Permission.UPDATE_COURSE)
  @Post(':id/enrollment/:studentId/payment')
  async addPaymentToEnrollment(
    @Param('id') courseId: string,
    @Param('studentId') studentId: string,
    @Body() paymentData: PaymentDto,
    @Req() req,
  ) {
    
    
    
    const userId = getUserIdFromRequest(req);
    
    // Primero buscar el enrollment
    const enrollments = await this.coursesService.getEnrollmentsByCourse(courseId);
    const enrollment = enrollments.find(e => 
      (e.student as any)._id.toString() === studentId || e.student.toString() === studentId
    );
    
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found for this student and course');
    }
    
    // Acceder al ID de forma segura
    const enrollmentId = enrollment['_id'] ? enrollment['_id'].toString() : '';
    
    if (!enrollmentId) {
      throw new BadRequestException('Invalid enrollment ID');
    }
    
    return this.coursesService.addPaymentToEnrollment(
      enrollmentId,
      paymentData,
      userId
    );
  }

  @Get('migration/promo-fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async migratePromoFields() {
    this.logger.log('Migración de campos de promoción solicitada por un super admin');
    return this.coursesService.migrateExistingCourses();
  }
} 