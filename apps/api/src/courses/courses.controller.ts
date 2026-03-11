import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  Logger,
  Query,
  Delete,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
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
import {
  getUserIdFromRequest,
  getUserRoleFromRequest,
} from '../utils/token-handler';
import { PaymentDto } from './dto/payment.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

type ServiceUserRole = any; // Usamos any para evitar los errores de tipo

@Controller('courses')
export class CoursesController {
  private readonly logger = new Logger(CoursesController.name);

  constructor(private readonly coursesService: CoursesService) {}

  @Get('/seats/policy')
  @UseGuards(JwtAuthGuard)
  async getSeatPolicy(
    @Req() req,
    @Query('schoolId') schoolId?: string,
    @Query('courseId') courseId?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    const userId = getUserIdFromRequest(req);
    return this.coursesService.getSeatPolicyForUser(userId, {
      schoolId,
      courseId,
      ownerId,
    });
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
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
        throw new UnauthorizedException(
          'No tienes permiso para ver los cursos de otros usuarios',
        );
      }

      return this.coursesService.getEnrolledCourses(targetUserId);
    }

    // Si no se especifica usuario o es el mismo que el autenticado
    return this.coursesService.getEnrolledCourses(userId);
  }

  @Get('public/enrolled/:userId')
  async getPublicEnrolledCourses(@Param('userId') userId: string) {
    try {
      const courses = await this.coursesService.getEnrolledCourses(userId);
      return courses;
    } catch (error) {
      this.logger.error(`Error getting enrolled courses: ${error.message}`);
      return [];
    }
  }

  @Get('public/teaching/:userId')
  async getPublicTeachingCourses(@Param('userId') userId: string) {
    try {
      // Simple version - get courses where user is teacher
      const courses = await this.coursesService.findAll(userId, 'teacher');
      return courses.filter((course) => {
        // Check if user is the main teacher
        const isMainTeacher =
          course.teacher &&
          ((course.teacher as any)._id
            ? (course.teacher as any)._id.toString() === userId
            : course.teacher.toString() === userId);

        // Check if user is in the teachers array
        const isInTeachers =
          course.teachers &&
          course.teachers.some((t) =>
            (t as any)._id
              ? (t as any)._id.toString() === userId
              : t.toString() === userId,
          );

        return isMainTeacher || isInTeachers;
      });
    } catch (error) {
      this.logger.error(`Error getting teaching courses: ${error.message}`);
      return [];
    }
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @Req() req,
    @Query('includeSchedule') includeSchedule?: string,
  ) {
    try {
      // Get user information from token if available
      const userId = req.user?.sub;
      const userRole = req.user?.role;
      const shouldIncludeSchedule = includeSchedule === 'true';

      const result = await this.coursesService.getCourseForUser(
        id,
        userId,
        userRole,
        shouldIncludeSchedule,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error al obtener curso ${id}: ${error.message}`,
        error.stack,
      );
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
      return result;
    } catch (error) {
      this.logger.error(`Error creating course: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateCourseDto: UpdateCourseDto,
    @Req() req,
  ) {
    const userId = getUserIdFromRequest(req);

    try {
      const result = await this.coursesService.update(
        id,
        updateCourseDto,
        userId,
      );
      return result;
    } catch (error) {
      this.logger.error(`Error updating course: ${error.message}`, error.stack);
      throw error;
    }
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
    const userId = getUserIdFromRequest(req);

    try {
      const result = await this.coursesService.addStudent(
        id,
        studentId,
        userId,
      );
      return result;
    } catch (error) {
      this.logger.error(`Error adding student: ${error.message}`, error.stack);
      throw error;
    }
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
    const userId = getUserIdFromRequest(req);
    return this.coursesService.enrollStudent(id, studentId, userId);
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
    const userId = getUserIdFromRequest(req);
    await this.coursesService.unenrollStudent(id, studentId, userId);
    return { success: true };
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
    const userId = getUserIdFromRequest(req);

    try {
      const result = await this.coursesService.removeStudent(
        id,
        studentId,
        userId,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error removing student: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req) {
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;

    try {
      const result = await this.coursesService.remove(id, userId, userRole);
      return result;
    } catch (error) {
      this.logger.error(`Error removing course: ${error.message}`, error.stack);
      throw error;
    }
  }
}
