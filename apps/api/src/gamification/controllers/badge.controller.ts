import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { BadgeService } from '../services/badge.service';
import { CreateBadgeDto, UpdateBadgeDto } from '../dto/create-badge.dto';
import { AchievementStatus } from '../schemas/user-achievement.schema';
import { BadgeType } from '../schemas/badge.schema';

@Controller('gamification/badges')
@UseGuards(JwtAuthGuard)
export class BadgeController {
  constructor(private readonly badgeService: BadgeService) {}

  @Get()
  async getAllBadges(
    @Query('includeInactive') includeInactive: string = 'false',
    @Query('type') type?: BadgeType,
  ) {
    if (type) {
      return this.badgeService.getBadgesByType(type);
    }
    return this.badgeService.getAllBadges(includeInactive === 'true');
  }

  @Get('user/:userId')
  async getUserBadges(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
    @Query('status') status?: AchievementStatus,
  ) {
    // Users can only view their own badges unless they're admin/teacher
    const requestingUserId = req.user._id || req.user.sub;
    if (userId !== requestingUserId && !this.isAuthorized(req.user.role)) {
      userId = requestingUserId;
    }

    return this.badgeService.getUserBadges(userId, schoolId, status);
  }

  @Get('user/:userId/stats')
  async getUserBadgeStats(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    const requestingUserId = req.user._id || req.user.sub;
    if (userId !== requestingUserId && !this.isAuthorized(req.user.role)) {
      userId = requestingUserId;
    }

    return this.badgeService.getUserBadgeStats(userId, schoolId);
  }

  @Get('user/:userId/progress/:badgeId')
  async getBadgeProgress(
    @Param('userId') userId: string,
    @Param('badgeId') badgeId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    const requestingUserId = req.user._id || req.user.sub;
    if (userId !== requestingUserId && !this.isAuthorized(req.user.role)) {
      userId = requestingUserId;
    }

    return this.badgeService.getBadgeProgress(userId, badgeId, schoolId);
  }

  @Get('leaderboard/school/:schoolId')
  async getSchoolBadgeLeaderboard(
    @Param('schoolId') schoolId: string,
    @Query('limit') limit: string = '10',
  ) {
    return this.badgeService.getSchoolBadgeLeaderboard(
      schoolId,
      parseInt(limit),
    );
  }

  @Get(':id')
  async getBadgeById(@Param('id') id: string) {
    return this.badgeService.getBadgeById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async createBadge(@Body() createBadgeDto: CreateBadgeDto) {
    return this.badgeService.createBadge(createBadgeDto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async updateBadge(
    @Param('id') id: string,
    @Body() updateBadgeDto: UpdateBadgeDto,
  ) {
    return this.badgeService.updateBadge(id, updateBadgeDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBadge(@Param('id') id: string) {
    await this.badgeService.deleteBadge(id);
  }

  @Post('award')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async manualAwardBadge(
    @Body()
    body: {
      userId: string;
      badgeId: string;
      schoolId: string;
      comment?: string;
    },
    @Request() req,
  ) {
    const teacherId = req.user._id || req.user.sub;
    return this.badgeService.manualAwardBadge(
      body.userId,
      body.badgeId,
      body.schoolId,
      teacherId,
      body.comment,
    );
  }

  @Post('initialize')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async initializeUserBadgeProgress(
    @Body() body: { userId: string; schoolId: string; courseId?: string },
  ) {
    await this.badgeService.initializeUserBadgeProgress(
      body.userId,
      body.schoolId,
      body.courseId,
    );
    return { message: 'Badge progress initialized successfully' };
  }

  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedDefaultBadges() {
    await this.badgeService.seedDefaultBadges();
    return { message: 'Default badges seeded successfully' };
  }

  @Post('progress/update')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async updateBadgeProgress(
    @Body()
    body: {
      userId: string;
      schoolId: string;
      actionType: string;
      value: number;
      courseId?: string;
      classId?: string;
      metadata?: Record<string, any>;
    },
  ) {
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

  private isAuthorized(userRole: UserRole): boolean {
    return [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.TEACHER,
      UserRole.SCHOOL_OWNER,
    ].includes(userRole);
  }
}
