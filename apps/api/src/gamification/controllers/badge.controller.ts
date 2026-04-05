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
import { BadgeFacade } from '../services/badge.facade';
import { CreateBadgeDto, UpdateBadgeDto } from '../dto/create-badge.dto';
import { AchievementStatus } from '../schemas/user-achievement.schema';
import { BadgeType } from '../schemas/badge.schema';

@Controller('gamification/badges')
@UseGuards(JwtAuthGuard)
export class BadgeController {
  constructor(private readonly badgeFacade: BadgeFacade) {}

  @Get()
  async getAllBadges(
    @Query('includeInactive') includeInactive: string = 'false',
    @Query('type') type?: BadgeType,
  ) {
    return this.badgeFacade.getAllBadges(includeInactive, type);
  }

  @Get('user/:userId')
  async getUserBadges(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
    @Query('status') status?: AchievementStatus,
  ) {
    return this.badgeFacade.getUserBadges(
      userId,
      schoolId,
      req,
      status,
    );
  }

  @Get('user/:userId/stats')
  async getUserBadgeStats(
    @Param('userId') userId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    return this.badgeFacade.getUserBadgeStats(
      userId,
      schoolId,
      req,
    );
  }

  @Get('user/:userId/progress/:badgeId')
  async getBadgeProgress(
    @Param('userId') userId: string,
    @Param('badgeId') badgeId: string,
    @Query('schoolId') schoolId: string,
    @Request() req,
  ) {
    return this.badgeFacade.getBadgeProgress(
      userId,
      badgeId,
      schoolId,
      req,
    );
  }

  @Get('leaderboard/school/:schoolId')
  async getSchoolBadgeLeaderboard(
    @Param('schoolId') schoolId: string,
    @Query('limit') limit: string = '10',
  ) {
    return this.badgeFacade.getSchoolBadgeLeaderboard(
      schoolId,
      limit,
    );
  }

  @Get(':id')
  async getBadgeById(@Param('id') id: string) {
    return this.badgeFacade.getBadgeById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async createBadge(@Body() createBadgeDto: CreateBadgeDto) {
    return this.badgeFacade.createBadge(createBadgeDto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async updateBadge(
    @Param('id') id: string,
    @Body() updateBadgeDto: UpdateBadgeDto,
  ) {
    return this.badgeFacade.updateBadge(id, updateBadgeDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBadge(@Param('id') id: string) {
    await this.badgeFacade.deleteBadge(id);
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
    return this.badgeFacade.manualAwardBadge(body, req);
  }

  @Post('initialize')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async initializeUserBadgeProgress(
    @Body() body: { userId: string; schoolId: string; courseId?: string },
  ) {
    return this.badgeFacade.initializeUserBadgeProgress(body);
  }

  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedDefaultBadges() {
    return this.badgeFacade.seedDefaultBadges();
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
    return this.badgeFacade.updateBadgeProgress(body);
  }
}
