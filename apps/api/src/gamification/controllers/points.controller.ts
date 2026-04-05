import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';
import { PointsFacade } from '../services/points.facade';
import {
  AwardPointsDto,
  DeductPointsDto,
  UpdateStreakDto,
  TeacherRewardDto,
  UserProgressDto,
} from '../dto/points.dto';

@Controller('gamification/points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsFacade: PointsFacade) {}

  @Get('user/:userId')
  async getUserPoints(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    return this.pointsFacade.getUserPoints(userId, schoolId, req);
  }

  @Get('user/:userId/rank')
  async getUserRank(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    return this.pointsFacade.getUserRank(userId, schoolId, req);
  }

  @Get('user/:userId/progress')
  async getUserProgress(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeBadges') includeBadges?: string,
    @Query('includeTransactions') includeTransactions?: string,
    @Query('includeComparisons') includeComparisons?: string,
  ) {
    return this.pointsFacade.getUserProgress(
      userId,
      schoolId,
      req,
      startDate,
      endDate,
      includeBadges,
      includeTransactions,
      includeComparisons,
    );
  }

  @Get('leaderboard/school/:schoolId')
  async getSchoolTopUsers(
    @Param('schoolId') schoolId: string,
    @Query('limit') limit: string = '10',
  ) {
    return this.pointsFacade.getSchoolTopUsers(schoolId, limit);
  }

  @Post('award')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async awardPoints(@Body() awardPointsDto: AwardPointsDto) {
    return this.pointsFacade.awardPoints(awardPointsDto);
  }

  @Post('deduct')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async deductPoints(@Body() deductPointsDto: DeductPointsDto) {
    return this.pointsFacade.deductPoints(deductPointsDto);
  }

  @Post('streak/update')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async updateStreak(@Body() updateStreakDto: UpdateStreakDto) {
    return this.pointsFacade.updateStreak(updateStreakDto);
  }

  @Post('teacher-reward')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async teacherReward(@Body() teacherRewardDto: TeacherRewardDto) {
    return this.pointsFacade.teacherReward(teacherRewardDto);
  }

  @Post('initialize')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async initializeUserPoints(
    @Body() body: { userId: string; schoolId: string },
  ) {
    return this.pointsFacade.initializeUserPoints(body);
  }

  @Post('seed-levels')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedDefaultLevels() {
    return this.pointsFacade.seedDefaultLevels();
  }

  @Get('stats/school/:schoolId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
  )
  async getSchoolPointsStats(
    @Param('schoolId') schoolId: string,
    @Query('period') period: string = 'monthly',
  ) {
    return this.pointsFacade.getSchoolPointsStats(schoolId, period);
  }

  @Get('test/health')
  async testHealth() {
    return this.pointsFacade.testHealth();
  }

  @Get('test/user/:userId')
  async testGetUser(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
  ) {
    return this.pointsFacade.testGetUser(userId, schoolId);
  }

  @Get('public/user/:userId')
  async getPublicUserPoints(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.pointsFacade.getPublicUserPoints(userId, schoolId);
  }
}
