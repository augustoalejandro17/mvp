import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  SetMetadata,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';
import { LeaderboardService } from '../services/leaderboard.service';
import {
  LeaderboardType,
  LeaderboardPeriod,
} from '../schemas/leaderboard.schema';
import { GetLeaderboardDto } from '../dto/points.dto';

@Controller('gamification/leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
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

  @Get()
  async getLeaderboard(
    @Query('type') type: string = 'school',
    @Query('period') period: string = 'monthly',
    @Query('schoolId') schoolId?: string,
    @Query('courseId') courseId?: string,
    @Query('category') category?: string,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
    @Query('includeInactive') includeInactive: string = 'false',
  ) {
    const limitNum = this.parseIntInRange(limit, 'limit', 1, 100);
    const offsetNum = this.parseIntInRange(offset, 'offset', 0, 10000);

    const getLeaderboardDto: GetLeaderboardDto = {
      type,
      period,
      schoolId,
      courseId,
      category,
      limit: limitNum,
      offset: offsetNum,
      includeInactive: includeInactive === 'true',
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  @Get('position/:userId')
  async getUserPosition(
    @Param('userId') userId: string,
    @Request() req,
    @Query('type') type: string = 'school',
    @Query('period') period: string = 'monthly',
    @Query('schoolId') schoolId?: string,
    @Query('courseId') courseId?: string,
    @Query('category') category?: string,
  ) {
    const requestingUserId = req.user._id || req.user.sub;
    if (userId !== requestingUserId && !this.isAuthorized(req.user.role)) {
      userId = requestingUserId;
    }

    return this.leaderboardService.getUserLeaderboardPosition(
      userId,
      type as LeaderboardType,
      period as LeaderboardPeriod,
      schoolId,
      courseId,
      category,
    );
  }

  @Get('top-performers/school/:schoolId')
  async getTopPerformers(
    @Param('schoolId') schoolId: string,
    @Query('period') period: string = 'monthly',
    @Query('limit') limit: string = '5',
  ) {
    const limitNum = this.parseIntInRange(limit, 'limit', 1, 100);
    return this.leaderboardService.getTopPerformers(
      schoolId,
      period as LeaderboardPeriod,
      limitNum,
    );
  }

  @Get('course/:courseId')
  async getCourseLeaderboard(
    @Param('courseId') courseId: string,
    @Query('period') period: string = 'weekly',
    @Query('limit') limit: string = '10',
  ) {
    const limitNum = this.parseIntInRange(limit, 'limit', 1, 100);
    return this.leaderboardService.getCourseLeaderboard(
      courseId,
      period as LeaderboardPeriod,
      limitNum,
    );
  }

  @Get('global')
  @SetMetadata('isPublic', true)
  async getGlobalLeaderboard(
    @Query('period') period: string = 'monthly',
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    const limitNum = this.parseIntInRange(limit, 'limit', 1, 100);
    const offsetNum = this.parseIntInRange(offset, 'offset', 0, 10000);

    const getLeaderboardDto: GetLeaderboardDto = {
      type: 'global',
      period,
      limit: limitNum,
      offset: offsetNum,
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  @Get('school/:schoolId')
  async getSchoolLeaderboard(
    @Param('schoolId') schoolId: string,
    @Query('period') period: string = 'monthly',
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ) {
    const limitNum = this.parseIntInRange(limit, 'limit', 1, 100);
    const offsetNum = this.parseIntInRange(offset, 'offset', 0, 10000);

    const getLeaderboardDto: GetLeaderboardDto = {
      type: 'school',
      period,
      schoolId,
      limit: limitNum,
      offset: offsetNum,
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  @Get('category/:category')
  async getCategoryLeaderboard(
    @Param('category') category: string,
    @Query('period') period: string = 'monthly',
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ) {
    const limitNum = this.parseIntInRange(limit, 'limit', 1, 100);
    const offsetNum = this.parseIntInRange(offset, 'offset', 0, 10000);

    const getLeaderboardDto: GetLeaderboardDto = {
      type: 'category',
      period,
      category,
      limit: limitNum,
      offset: offsetNum,
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  @Get('user/:userId/surrounding')
  async getUserSurrounding(
    @Param('userId') userId: string,
    @Request() req,
    @Query('type') type: string = 'school',
    @Query('period') period: string = 'monthly',
    @Query('schoolId') schoolId?: string,
    @Query('courseId') courseId?: string,
    @Query('category') category?: string,
    @Query('range') range: string = '5',
  ) {
    const requestingUserId = req.user._id || req.user.sub;
    if (userId !== requestingUserId && !this.isAuthorized(req.user.role)) {
      userId = requestingUserId;
    }

    const userPosition =
      await this.leaderboardService.getUserLeaderboardPosition(
        userId,
        type as LeaderboardType,
        period as LeaderboardPeriod,
        schoolId,
        courseId,
        category,
      );

    const rangeNum = this.parseIntInRange(range, 'range', 1, 50);
    const startOffset = Math.max(0, userPosition.position - rangeNum - 1);
    const limit = rangeNum * 2 + 1;

    const getLeaderboardDto: GetLeaderboardDto = {
      type,
      period,
      schoolId,
      courseId,
      category,
      limit,
      offset: startOffset,
    };

    const leaderboard =
      await this.leaderboardService.getLeaderboard(getLeaderboardDto);

    return {
      userPosition: userPosition.position,
      totalParticipants: userPosition.totalParticipants,
      surrounding: leaderboard,
    };
  }

  @Get('periods')
  async getAvailablePeriods() {
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

  @Get('types')
  async getAvailableTypes() {
    return {
      types: [
        { value: 'global', label: 'Global' },
        { value: 'school', label: 'School' },
        { value: 'course', label: 'Course' },
        { value: 'category', label: 'Category' },
      ],
    };
  }

  @Get('test/health')
  async testHealth() {
    return {
      status: 'healthy',
      service: 'gamification-leaderboard',
      timestamp: new Date(),
    };
  }

  @Get('test/global')
  @SetMetadata('isPublic', true)
  async testGlobalLeaderboard(
    @Query('period') period: string = 'all_time',
    @Query('limit') limit: string = '20',
  ) {
    const limitNum = this.parseIntInRange(limit, 'limit', 1, 100);
    const getLeaderboardDto: GetLeaderboardDto = {
      type: 'global',
      period,
      limit: limitNum,
      offset: 0,
    };

    return this.leaderboardService.getLeaderboard(getLeaderboardDto);
  }

  private isAuthorized(userRole: UserRole): boolean {
    return [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.TEACHER,
      UserRole.SCHOOL_OWNER,
    ].includes(userRole);
  }
}
