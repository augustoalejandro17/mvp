import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../auth/enums/user-role.enum';
import {
  AwardPointsDto,
  DeductPointsDto,
  TeacherRewardDto,
  UpdateStreakDto,
  UserProgressDto,
} from '../dto/points.dto';
import { PointsService } from './points.service';

@Injectable()
export class PointsFacade {
  constructor(private readonly pointsService: PointsService) {}

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

  getUserPoints(userId: string, schoolId: string, req: Request) {
    return this.pointsService.getUserPoints(
      this.resolveRequestedUserId(userId, req),
      schoolId,
    );
  }

  getUserRank(userId: string, schoolId: string, req: Request) {
    return this.pointsService.getUserRank(
      this.resolveRequestedUserId(userId, req),
      schoolId,
    );
  }

  async getUserProgress(
    userId: string,
    schoolId: string,
    req: Request,
    startDate?: string,
    endDate?: string,
    includeBadges?: string,
    includeTransactions?: string,
    includeComparisons?: string,
  ) {
    const resolvedUserId = this.resolveRequestedUserId(userId, req);
    const userProgress: UserProgressDto = {
      userId: resolvedUserId,
      schoolId,
      startDate,
      endDate,
      includeBadges: includeBadges === 'true',
      includeTransactions: includeTransactions === 'true',
      includeComparisons: includeComparisons === 'true',
    };

    const [userPoints, userRank] = await Promise.all([
      this.pointsService.getUserPoints(resolvedUserId, schoolId),
      this.pointsService.getUserRank(resolvedUserId, schoolId),
    ]);

    return {
      user: userPoints,
      rank: userRank,
      progress: userProgress,
    };
  }

  getSchoolTopUsers(schoolId: string, limit: string = '10') {
    return this.pointsService.getTopUsers(schoolId, this.parseLimit(limit));
  }

  awardPoints(awardPointsDto: AwardPointsDto) {
    return this.pointsService.awardPoints(awardPointsDto);
  }

  deductPoints(deductPointsDto: DeductPointsDto) {
    return this.pointsService.deductPoints(deductPointsDto);
  }

  updateStreak(updateStreakDto: UpdateStreakDto) {
    return this.pointsService.updateStreak(updateStreakDto);
  }

  teacherReward(teacherRewardDto: TeacherRewardDto) {
    const awardPointsDto: AwardPointsDto = {
      userId: teacherRewardDto.studentId,
      schoolId: teacherRewardDto.schoolId,
      points: teacherRewardDto.points,
      actionType: 'teacher_reward' as any,
      description: teacherRewardDto.reason,
      courseId: teacherRewardDto.courseId,
      metadata: {
        comment: teacherRewardDto.comment,
        teacherReward: true,
      },
      sendNotification: teacherRewardDto.sendNotification,
    };

    return this.pointsService.awardPoints(awardPointsDto);
  }

  async initializeUserPoints(body: { userId: string; schoolId: string }) {
    await this.pointsService.initializeUserPoints(body.userId, body.schoolId);
    return { message: 'User points initialized successfully' };
  }

  async seedDefaultLevels() {
    await this.pointsService.seedDefaultLevels();
    return { message: 'Default levels seeded successfully' };
  }

  async getSchoolPointsStats(
    schoolId: string,
    period: string = 'monthly',
  ) {
    const topUsers = await this.pointsService.getTopUsers(schoolId, 10);

    return {
      topUsers,
      period,
      totalUsers: topUsers.length,
      averagePoints:
        topUsers.length > 0
          ? topUsers.reduce((sum, user) => sum + user.totalPoints, 0) /
            topUsers.length
          : 0,
    };
  }

  testHealth() {
    return {
      status: 'healthy',
      service: 'gamification-points',
      timestamp: new Date(),
    };
  }

  async testGetUser(userId: string, schoolId: string) {
    try {
      const existingPoints = await this.pointsService.getUserPoints(
        userId,
        schoolId,
      );
      return {
        status: 'success',
        userId,
        schoolId,
        hasExistingPoints: !!existingPoints,
        existingPoints,
      };
    } catch (error) {
      return {
        status: 'error',
        userId,
        schoolId,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  async getPublicUserPoints(userId: string, schoolId?: string) {
    try {
      let resolvedSchoolId = schoolId;

      if (!resolvedSchoolId) {
        const userPointsRecord =
          await this.pointsService.findUserPointsRecord(userId);
        if (userPointsRecord) {
          resolvedSchoolId = userPointsRecord.school.toString();
        }
      }

      if (!resolvedSchoolId) {
        return {
          userId,
          schoolId: null,
          points: 0,
          level: 1,
          streak: 0,
          rank: 1,
          badges: 0,
          levelName: 'Beginner',
          pointsToNextLevel: 100,
        };
      }

      const userPoints = await this.pointsService.getUserPoints(
        userId,
        resolvedSchoolId,
      );

      if (!userPoints) {
        return {
          userId,
          schoolId: resolvedSchoolId,
          points: 0,
          level: 1,
          streak: 0,
          rank: 1,
          badges: 0,
          levelName: 'Beginner',
          pointsToNextLevel: 100,
        };
      }

      const rankData = await this.pointsService.getUserRank(
        userId,
        resolvedSchoolId,
      );

      return {
        userId,
        schoolId: resolvedSchoolId,
        points: userPoints.totalPoints,
        level: userPoints.level,
        streak: userPoints.streak,
        rank: rankData.schoolRank,
        badges: 0,
        levelName: userPoints.levelInfo?.name || 'Beginner',
        pointsToNextLevel: userPoints.pointsToNextLevel,
        lastActivity: userPoints.lastActivityDate,
      };
    } catch (error) {
      return {
        userId,
        schoolId: schoolId || null,
        points: 0,
        level: 1,
        streak: 0,
        rank: 1,
        badges: 0,
        levelName: 'Beginner',
        pointsToNextLevel: 100,
        error: error.message,
      };
    }
  }
}
