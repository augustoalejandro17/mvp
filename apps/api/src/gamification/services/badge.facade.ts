import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../auth/enums/user-role.enum';
import { CreateBadgeDto, UpdateBadgeDto } from '../dto/create-badge.dto';
import { BadgeType } from '../schemas/badge.schema';
import { AchievementStatus } from '../schemas/user-achievement.schema';
import { BadgeService } from './badge.service';

@Injectable()
export class BadgeFacade {
  constructor(private readonly badgeService: BadgeService) {}

  private parseLimit(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      throw new BadRequestException('limit debe ser un entero entre 1 y 100');
    }
    return parsed;
  }

  private isAuthorized(userRole: UserRole): boolean {
    return [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.TEACHER,
      UserRole.SCHOOL_OWNER,
    ].includes(userRole);
  }

  private resolveRequestedUserId(userId: string, req: Request): string {
    const authUser = req.user as Record<string, any>;
    const requestingUserId = String(authUser._id || authUser.sub);
    if (userId !== requestingUserId && !this.isAuthorized(authUser.role)) {
      return requestingUserId;
    }
    return userId;
  }

  getAllBadges(includeInactive: string = 'false', type?: BadgeType) {
    if (type) {
      return this.badgeService.getBadgesByType(type);
    }
    return this.badgeService.getAllBadges(includeInactive === 'true');
  }

  getUserBadges(
    userId: string,
    schoolId: string,
    req: Request,
    status?: AchievementStatus,
  ) {
    return this.badgeService.getUserBadges(
      this.resolveRequestedUserId(userId, req),
      schoolId,
      status,
    );
  }

  getUserBadgeStats(userId: string, schoolId: string, req: Request) {
    return this.badgeService.getUserBadgeStats(
      this.resolveRequestedUserId(userId, req),
      schoolId,
    );
  }

  getBadgeProgress(
    userId: string,
    badgeId: string,
    schoolId: string,
    req: Request,
  ) {
    return this.badgeService.getBadgeProgress(
      this.resolveRequestedUserId(userId, req),
      badgeId,
      schoolId,
    );
  }

  getSchoolBadgeLeaderboard(schoolId: string, limit: string = '10') {
    return this.badgeService.getSchoolBadgeLeaderboard(
      schoolId,
      this.parseLimit(limit),
    );
  }

  getBadgeById(id: string) {
    return this.badgeService.getBadgeById(id);
  }

  createBadge(createBadgeDto: CreateBadgeDto) {
    return this.badgeService.createBadge(createBadgeDto);
  }

  updateBadge(id: string, updateBadgeDto: UpdateBadgeDto) {
    return this.badgeService.updateBadge(id, updateBadgeDto);
  }

  deleteBadge(id: string) {
    return this.badgeService.deleteBadge(id);
  }

  manualAwardBadge(
    body: { userId: string; badgeId: string; schoolId: string; comment?: string },
    req: Request,
  ) {
    const authUser = req.user as Record<string, any>;
    const teacherId = String(authUser._id || authUser.sub);
    return this.badgeService.manualAwardBadge(
      body.userId,
      body.badgeId,
      body.schoolId,
      teacherId,
      body.comment,
    );
  }

  async initializeUserBadgeProgress(body: {
    userId: string;
    schoolId: string;
    courseId?: string;
  }) {
    await this.badgeService.initializeUserBadgeProgress(
      body.userId,
      body.schoolId,
      body.courseId,
    );
    return { message: 'Badge progress initialized successfully' };
  }

  async seedDefaultBadges() {
    await this.badgeService.seedDefaultBadges();
    return { message: 'Default badges seeded successfully' };
  }

  async updateBadgeProgress(body: {
    userId: string;
    schoolId: string;
    actionType: string;
    value: number;
    courseId?: string;
    classId?: string;
    metadata?: Record<string, any>;
  }) {
    const achievements = await this.badgeService.updateBadgeProgress(
      body.userId,
      body.schoolId,
      body.actionType,
      body.value,
      body.courseId,
      body.classId,
      body.metadata,
    );

    return {
      message: 'Badge progress updated successfully',
      completedAchievements: achievements.length,
      achievements,
    };
  }
}
