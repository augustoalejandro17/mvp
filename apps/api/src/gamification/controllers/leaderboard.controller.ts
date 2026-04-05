import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  SetMetadata,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';
import { LeaderboardFacade } from '../services/leaderboard.facade';
import {
  LeaderboardType,
  LeaderboardPeriod,
} from '../schemas/leaderboard.schema';

@Controller('gamification/leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardFacade: LeaderboardFacade) {}

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
    return this.leaderboardFacade.getLeaderboard({
      type,
      period,
      schoolId,
      courseId,
      category,
      limit,
      offset,
      includeInactive,
    });
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
    return this.leaderboardFacade.getUserPosition(userId, req, {
      type,
      period,
      schoolId,
      courseId,
      category,
    });
  }

  @Get('top-performers/school/:schoolId')
  async getTopPerformers(
    @Param('schoolId') schoolId: string,
    @Query('period') period: string = 'monthly',
    @Query('limit') limit: string = '5',
  ) {
    return this.leaderboardFacade.getTopPerformers(
      schoolId,
      period,
      limit,
    );
  }

  @Get('course/:courseId')
  async getCourseLeaderboard(
    @Param('courseId') courseId: string,
    @Query('period') period: string = 'weekly',
    @Query('limit') limit: string = '10',
  ) {
    return this.leaderboardFacade.getCourseLeaderboard(
      courseId,
      period,
      limit,
    );
  }

  @Get('global')
  @SetMetadata('isPublic', true)
  async getGlobalLeaderboard(
    @Query('period') period: string = 'monthly',
    @Query('limit') limit: string = '50',
    @Query('offset') offset: string = '0',
  ) {
    return this.leaderboardFacade.getGlobalLeaderboard(
      period,
      limit,
      offset,
    );
  }

  @Get('school/:schoolId')
  async getSchoolLeaderboard(
    @Param('schoolId') schoolId: string,
    @Query('period') period: string = 'monthly',
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ) {
    return this.leaderboardFacade.getSchoolLeaderboard(
      schoolId,
      period,
      limit,
      offset,
    );
  }

  @Get('category/:category')
  async getCategoryLeaderboard(
    @Param('category') category: string,
    @Query('period') period: string = 'monthly',
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ) {
    return this.leaderboardFacade.getCategoryLeaderboard(
      category,
      period,
      limit,
      offset,
    );
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
    return this.leaderboardFacade.getUserSurrounding(userId, req, {
      schoolId,
      type,
      period,
      courseId,
      category,
      range,
    });
  }

  @Get('periods')
  async getAvailablePeriods() {
    return this.leaderboardFacade.getAvailablePeriods();
  }

  @Get('types')
  async getAvailableTypes() {
    return this.leaderboardFacade.getAvailableTypes();
  }

  @Get('test/health')
  async testHealth() {
    return this.leaderboardFacade.testHealth();
  }

  @Get('test/global')
  @SetMetadata('isPublic', true)
  async testGlobalLeaderboard(
    @Query('period') period: string = 'all_time',
    @Query('limit') limit: string = '20',
  ) {
    return this.leaderboardFacade.testGlobalLeaderboard(
      period,
      limit,
    );
  }
}
