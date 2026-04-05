import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import {
  CourseProgressSummary,
  UserProgressService,
} from './user-progress.service';

@Injectable()
export class ProgressFacade {
  private readonly logger = new Logger(ProgressFacade.name);

  constructor(private readonly userProgressService: UserProgressService) {}

  private ensureCanAccessUserProgress(req: Request, targetUserId: string): void {
    const requesterId = String(req.user['sub'] || req.user['_id'] || '');
    const requesterRole = String(req.user['role'] || '').toLowerCase();
    const canViewAny = [
      'super_admin',
      'admin',
      'school_owner',
      'administrative',
    ].includes(requesterRole);

    if (!canViewAny && requesterId !== targetUserId) {
      throw new ForbiddenException(
        'No tienes permisos para consultar el progreso de otro usuario',
      );
    }
  }

  private ensurePublicEnabled() {
    if (process.env.ENABLE_PUBLIC_PROGRESS !== 'true') {
      throw new ForbiddenException('Public progress endpoint is disabled');
    }
  }

  async getUserCourseProgress(
    req: Request,
    userId: string,
    courseId: string,
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

  async getUserCoursesProgress(
    req: Request,
    userId: string,
    schoolId?: string,
  ) {
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

  async getUserClassProgressInCourse(
    req: Request,
    userId: string,
    courseId: string,
  ) {
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

  async markClassCompleted(req: Request, classId: string) {
    const userId = String(req.user['sub'] || req.user['_id']);
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

  async getPublicUserCourseProgress(userId: string, courseId: string) {
    try {
      this.ensurePublicEnabled();
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

  async getPublicUserCoursesProgress(userId: string, schoolId?: string) {
    try {
      this.ensurePublicEnabled();
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
