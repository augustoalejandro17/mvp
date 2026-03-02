import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  UserProgressService,
  CourseProgressSummary,
} from './services/user-progress.service';
import { UserClassProgressDocument } from './schemas/user-class-progress.schema';

@Controller('progress')
export class ProgressController {
  private readonly logger = new Logger(ProgressController.name);

  constructor(private readonly userProgressService: UserProgressService) {}

  /**
   * Get user's progress for a specific course
   */
  @Get('course/:courseId/user/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserCourseProgress(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ): Promise<CourseProgressSummary | null> {
    try {
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
    @Query('schoolId') schoolId?: string,
  ): Promise<CourseProgressSummary[]> {
    try {
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
  ): Promise<UserClassProgressDocument[]> {
    try {
      return await this.userProgressService.getUserClassProgressInCourse(
        userId,
        courseId,
      );
    } catch (error) {
      this.logger.error(`Error getting user class progress: ${error.message}`);
      throw error;
    }
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
