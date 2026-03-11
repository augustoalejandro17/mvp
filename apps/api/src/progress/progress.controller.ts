import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../auth/schemas/user.schema';
import {
  UserProgressService,
  CourseProgressSummary,
} from './services/user-progress.service';
import { UserClassProgressDocument } from './schemas/user-class-progress.schema';

@Controller('progress')
export class ProgressController {
  private readonly logger = new Logger(ProgressController.name);

  constructor(private readonly userProgressService: UserProgressService) {}

  private ensureCanAccessUserProgress(req: Request, targetUserId: string): void {
    const requesterId = String(req.user['sub'] || req.user['_id'] || '');
    const requesterRole = String(req.user['role'] || '').toLowerCase();
    const canViewAny = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.SCHOOL_OWNER,
      UserRole.ADMINISTRATIVE,
    ].includes(requesterRole as UserRole);

    if (!canViewAny && requesterId !== targetUserId) {
      throw new ForbiddenException(
        'No tienes permisos para consultar el progreso de otro usuario',
      );
    }
  }

  /**
   * Get user's progress for a specific course
   */
  @Get('course/:courseId/user/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserCourseProgress(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<CourseProgressSummary | null> {
    try {
      this.ensureCanAccessUserProgress(req, userId);
      return await this.userProgressService.getUserCourseProgress(
        userId,
        courseId,
      );
    } catch (error) {
      this.logger.error(`Error getting user course progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's progress for all courses
   */
  @Get('user/:userId/courses')
  @UseGuards(JwtAuthGuard)
  async getUserCoursesProgress(
    @Param('userId') userId: string,
    @Req() req: Request,
    @Query('schoolId') schoolId?: string,
  ): Promise<CourseProgressSummary[]> {
    try {
      this.ensureCanAccessUserProgress(req, userId);
      return await this.userProgressService.getUserCoursesProgress(
        userId,
        schoolId,
      );
    } catch (error) {
      this.logger.error(
        `Error getting user courses progress: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get detailed class progress for a user in a course
   */
  @Get('course/:courseId/user/:userId/classes')
  @UseGuards(JwtAuthGuard)
  async getUserClassProgressInCourse(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<UserClassProgressDocument[]> {
    try {
      this.ensureCanAccessUserProgress(req, userId);
      return await this.userProgressService.getUserClassProgressInCourse(
        userId,
        courseId,
      );
    } catch (error) {
      this.logger.error(`Error getting user class progress: ${error.message}`);
      throw error;
    }
  }

  @Post('class/:classId/complete')
  @UseGuards(JwtAuthGuard)
  async markClassCompleted(
    @Param('classId') classId: string,
    @Req() req: Request,
  ) {
    const userId = req.user['sub'] || req.user['_id'];
    const classProgress = await this.userProgressService.markClassCompleted(
      userId,
      classId,
    );

    return {
      success: true,
      completed: classProgress.completed,
      completedAt: classProgress.completedAt,
      classProgress,
    };
  }

  /**
   * Public endpoint for getting user course progress (for community page)
   */
  @Get('public/course/:courseId/user/:userId')
  async getPublicUserCourseProgress(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ): Promise<CourseProgressSummary | null> {
    try {
      if (process.env.ENABLE_PUBLIC_PROGRESS !== 'true') {
        throw new ForbiddenException('Public progress endpoint is disabled');
      }
      return await this.userProgressService.getUserCourseProgress(
        userId,
        courseId,
      );
    } catch (error) {
      this.logger.error(
        `Error getting public user course progress: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Public endpoint for getting user courses progress (for community page)
   */
  @Get('public/user/:userId/courses')
  async getPublicUserCoursesProgress(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId?: string,
  ): Promise<CourseProgressSummary[]> {
    try {
      if (process.env.ENABLE_PUBLIC_PROGRESS !== 'true') {
        throw new ForbiddenException('Public progress endpoint is disabled');
      }
      return await this.userProgressService.getUserCoursesProgress(
        userId,
        schoolId,
      );
    } catch (error) {
      this.logger.error(
        `Error getting public user courses progress: ${error.message}`,
      );
      throw error;
    }
  }
}
