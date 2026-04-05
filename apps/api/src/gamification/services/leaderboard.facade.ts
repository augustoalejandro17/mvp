import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../auth/enums/user-role.enum';
import { GetLeaderboardDto } from '../dto/points.dto';
import {
  LeaderboardPeriod,
  LeaderboardType,
} from '../schemas/leaderboard.schema';
import { LeaderboardService } from './leaderboard.service';

@Injectable()
export class LeaderboardFacade {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  private parseIntInRange(
    value: string,
    fieldName: string,
    min: number,
    max: number,
  ): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(
        `${fieldName} debe ser un entero entre ${min} y ${max}`,
      );
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

  getLeaderboard(query: {
    type?: string;
    period?: string;
    schoolId?: string;
    courseId?: string;
    category?: string;
    limit?: string;
    offset?: string;
    includeInactive?: string;
  }) {
    const getLeaderboardDto: GetLeaderboardDto = {
      type: query.type || 'school',
      period: query.period || 'monthly',
      schoolId: query.schoolId,
      courseId: query.courseId,
      category: query.category,
      limit: this.parseIntInRange(query.limit || '10', 'limit', 1, 100),
      offset: this.parseIntInRange(query.offset || '0', 'offset', 0, 10000),
      includeInactive: query.includeInactive === 'true',
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  getUserPosition(
    userId: string,
    req: Request,
    query: {
      type?: string;
      period?: string;
      schoolId?: string;
      courseId?: string;
      category?: string;
    },
  ) {
    return this.leaderboardService.getUserLeaderboardPosition(
      this.resolveRequestedUserId(userId, req),
      (query.type || 'school') as LeaderboardType,
      (query.period || 'monthly') as LeaderboardPeriod,
      query.schoolId,
      query.courseId,
      query.category,
    );
  }

  getTopPerformers(
    schoolId: string,
    period: string = 'monthly',
    limit: string = '5',
  ) {
    return this.leaderboardService.getTopPerformers(
      schoolId,
      period as LeaderboardPeriod,
      this.parseIntInRange(limit, 'limit', 1, 100),
    );
  }

  getCourseLeaderboard(
    courseId: string,
    period: string = 'weekly',
    limit: string = '10',
  ) {
    return this.leaderboardService.getCourseLeaderboard(
      courseId,
      period as LeaderboardPeriod,
      this.parseIntInRange(limit, 'limit', 1, 100),
    );
  }

  getGlobalLeaderboard(
    period: string = 'monthly',
    limit: string = '50',
    offset: string = '0',
  ) {
    const getLeaderboardDto: GetLeaderboardDto = {
      type: 'global',
      period,
      limit: this.parseIntInRange(limit, 'limit', 1, 100),
      offset: this.parseIntInRange(offset, 'offset', 0, 10000),
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  getSchoolLeaderboard(
    schoolId: string,
    period: string = 'monthly',
    limit: string = '20',
    offset: string = '0',
  ) {
    const getLeaderboardDto: GetLeaderboardDto = {
      type: 'school',
      period,
      schoolId,
      limit: this.parseIntInRange(limit, 'limit', 1, 100),
      offset: this.parseIntInRange(offset, 'offset', 0, 10000),
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  getCategoryLeaderboard(
    category: string,
    period: string = 'monthly',
    limit: string = '20',
    offset: string = '0',
  ) {
    const getLeaderboardDto: GetLeaderboardDto = {
      type: 'category',
      period,
      category,
      limit: this.parseIntInRange(limit, 'limit', 1, 100),
      offset: this.parseIntInRange(offset, 'offset', 0, 10000),
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  async getUserSurrounding(
    userId: string,
    req: Request,
    query: {
      type?: string;
      period?: string;
      schoolId?: string;
      courseId?: string;
      category?: string;
      range?: string;
    },
  ) {
    const resolvedUserId = this.resolveRequestedUserId(userId, req);
    const userPosition = await this.leaderboardService.getUserLeaderboardPosition(
      resolvedUserId,
      (query.type || 'school') as LeaderboardType,
      (query.period || 'monthly') as LeaderboardPeriod,
      query.schoolId,
      query.courseId,
      query.category,
    );

    const rangeNum = this.parseIntInRange(query.range || '5', 'range', 1, 50);
    const startOffset = Math.max(0, userPosition.position - rangeNum - 1);
    const limit = rangeNum * 2 + 1;

    const leaderboard = await this.leaderboardService.getLeaderboard({
      type: query.type || 'school',
      period: query.period || 'monthly',
      schoolId: query.schoolId,
      courseId: query.courseId,
      category: query.category,
      limit,
      offset: startOffset,
    });

    return {
      userPosition: userPosition.position,
      totalParticipants: userPosition.totalParticipants,
      surrounding: leaderboard,
    };
  }

  getAvailablePeriods() {
    return {
      periods: [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'yearly', label: 'Yearly' },
        { value: 'all_time', label: 'All Time' },
      ],
    };
  }

  getAvailableTypes() {
    return {
      types: [
        { value: 'global', label: 'Global' },
        { value: 'school', label: 'School' },
        { value: 'course', label: 'Course' },
        { value: 'category', label: 'Category' },
      ],
    };
  }

  testHealth() {
    return {
      status: 'healthy',
      service: 'gamification-leaderboard',
      timestamp: new Date(),
    };
  }

  testGlobalLeaderboard(
    period: string = 'all_time',
    limit: string = '20',
  ) {
    return this.leaderboardService.getLeaderboard({
      type: 'global',
      period,
      limit: this.parseIntInRange(limit, 'limit', 1, 100),
      offset: 0,
    });
  }
}
