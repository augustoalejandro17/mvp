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
import { PointsService } from '../services/points.service';
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
  constructor(private readonly pointsService: PointsService) {}

  @Get('user/:userId')
  async getUserPoints(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    // Check if user is authenticated (req.user exists)
    if (req.user) {
      const requestingUserId = req.user._id || req.user.sub;
      if (userId !== requestingUserId && !this.isAuthorized(req.user.role)) {
        userId = requestingUserId;
      }
    }
    // If no authentication, allow access to the requested userId (for public access)

    return this.pointsService.getUserPoints(userId, schoolId);
  }

  @Get('user/:userId/rank')
  async getUserRank(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    // Check if user is authenticated (req.user exists)
    if (req.user) {
      const requestingUserId = req.user._id || req.user.sub;
      if (userId !== requestingUserId && !this.isAuthorized(req.user.role)) {
        userId = requestingUserId;
      }
    }
    // If no authentication, allow access to the requested userId (for public access)

    return this.pointsService.getUserRank(userId, schoolId);
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
    // Check if user is authenticated (req.user exists)
    if (req.user) {
      const requestingUserId = req.user._id || req.user.sub;
      if (userId !== requestingUserId && !this.isAuthorized(req.user.role)) {
        userId = requestingUserId;
      }
    }
    // If no authentication, allow access to the requested userId (for public access)

    const userProgress: UserProgressDto = {
      userId,
      schoolId,
      startDate,
      endDate,
      includeBadges: includeBadges === 'true',
      includeTransactions: includeTransactions === 'true',
      includeComparisons: includeComparisons === 'true',
    };

    // This would be expanded with actual progress calculation
    const userPoints = await this.pointsService.getUserPoints(userId, schoolId);
    const userRank = await this.pointsService.getUserRank(userId, schoolId);

    return {
      user: userPoints,
      rank: userRank,
      progress: userProgress,
    };
  }

  @Get('leaderboard/school/:schoolId')
  async getSchoolTopUsers(
    @Param('schoolId') schoolId: string,
    @Query('limit') limit: string = '10',
  ) {
    return this.pointsService.getTopUsers(schoolId, parseInt(limit));
  }

  @Post('award')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async awardPoints(@Body() awardPointsDto: AwardPointsDto) {
    return this.pointsService.awardPoints(awardPointsDto);
  }

  @Post('deduct')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async deductPoints(@Body() deductPointsDto: DeductPointsDto) {
    return this.pointsService.deductPoints(deductPointsDto);
  }

  @Post('streak/update')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async updateStreak(@Body() updateStreakDto: UpdateStreakDto) {
    return this.pointsService.updateStreak(updateStreakDto);
  }

  @Post('teacher-reward')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async teacherReward(@Body() teacherRewardDto: TeacherRewardDto) {
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

  @Post('initialize')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async initializeUserPoints(
    @Body() body: { userId: string; schoolId: string },
  ) {
    await this.pointsService.initializeUserPoints(body.userId, body.schoolId);
    return { message: 'User points initialized successfully' };
  }

  @Post('seed-levels')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedDefaultLevels() {
    await this.pointsService.seedDefaultLevels();
    return { message: 'Default levels seeded successfully' };
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

  @Get('test/health')
  async testHealth() {
    return {
      status: 'healthy',
      service: 'gamification-points',
      timestamp: new Date(),
    };
  }

  @Get('test/user/:userId')
  async testGetUser(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
  ) {
    try {
      // Try to find existing user points
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

  @Get('public/user/:userId')
  async getPublicUserPoints(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    try {
      // If no school ID provided, try to find the user's school from their points records
      if (!schoolId) {
        const userPointsRecord =
          await this.pointsService.findUserPointsRecord(userId);
        if (userPointsRecord) {
          schoolId = userPointsRecord.school.toString();
        }
      }

      // If still no school ID, return default values
      if (!schoolId) {
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

      // Get user points
      const userPoints = await this.pointsService.getUserPoints(
        userId,
        schoolId,
      );

      if (!userPoints) {
        return {
          userId,
          schoolId,
          points: 0,
          level: 1,
          streak: 0,
          rank: 1,
          badges: 0,
          levelName: 'Beginner',
          pointsToNextLevel: 100,
        };
      }

      // Get user rank
      const rankData = await this.pointsService.getUserRank(userId, schoolId);

      return {
        userId,
        schoolId,
        points: userPoints.totalPoints,
        level: userPoints.level,
        streak: userPoints.streak,
        rank: rankData.schoolRank,
        badges: 0, // Simplified for now
        levelName: userPoints.levelInfo?.name || 'Beginner',
        pointsToNextLevel: userPoints.pointsToNextLevel,
        lastActivity: userPoints.lastActivityDate,
      };
    } catch (error) {
      // Return default values if there's an error
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

  private isAuthorized(userRole: UserRole): boolean {
    return [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.TEACHER,
      UserRole.SCHOOL_OWNER,
    ].includes(userRole);
  }
}
