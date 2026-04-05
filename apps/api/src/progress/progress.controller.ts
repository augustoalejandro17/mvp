import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CourseProgressSummary,
} from './services/user-progress.service';
import { UserClassProgressDocument } from './schemas/user-class-progress.schema';
import { ProgressFacade } from './services/progress.facade';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressFacade: ProgressFacade) {}

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
    return this.progressFacade.getUserCourseProgress(
      req,
      userId,
      courseId,
    );
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
    return this.progressFacade.getUserCoursesProgress(
      req,
      userId,
      schoolId,
    );
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
    return this.progressFacade.getUserClassProgressInCourse(
      req,
      userId,
      courseId,
    );
  }

  @Post('class/:classId/complete')
  @UseGuards(JwtAuthGuard)
  async markClassCompleted(
    @Param('classId') classId: string,
    @Req() req: Request,
  ) {
    return this.progressFacade.markClassCompleted(req, classId);
  }

  /**
   * Public endpoint for getting user course progress (for community page)
   */
  @Get('public/course/:courseId/user/:userId')
  async getPublicUserCourseProgress(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ): Promise<CourseProgressSummary | null> {
    return this.progressFacade.getPublicUserCourseProgress(
      userId,
      courseId,
    );
  }

  /**
   * Public endpoint for getting user courses progress (for community page)
   */
  @Get('public/user/:userId/courses')
  async getPublicUserCoursesProgress(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId?: string,
  ): Promise<CourseProgressSummary[]> {
    return this.progressFacade.getPublicUserCoursesProgress(
      userId,
      schoolId,
    );
  }
}
