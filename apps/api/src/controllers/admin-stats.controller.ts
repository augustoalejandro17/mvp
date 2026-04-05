import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { AdminStatsFacade } from '../services/admin-stats.facade';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_OWNER,
  UserRole.ADMIN,
  UserRole.ADMINISTRATIVE,
)
export class AdminStatsController {
  constructor(private readonly adminStatsFacade: AdminStatsFacade) {}

  @Get()
  async getStats(@Query('schoolId') schoolId: string, @Request() req) {
    return this.adminStatsFacade.getStatsForUser(req.user, schoolId);
  }

  @Get('subscriptions')
  @Roles(UserRole.SUPER_ADMIN)
  async getSubscriptionsStats() {
    return this.adminStatsFacade.getSubscriptionsStats();
  }

  @Get('subscriptions/:schoolId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER)
  async getSchoolSubscriptionDetails(
    @Param('schoolId') schoolId: string,
    @Request() req,
  ) {
    return this.adminStatsFacade.getSchoolSubscriptionDetails(
      schoolId,
      req.user,
    );
  }

  @Get('test')
  testEndpoint() {
    return {
      message: 'Admin stats test endpoint is working!',
      path: '/admin/stats/test',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('overview')
  async getOverviewStats(@Request() req) {
    return this.adminStatsFacade.getStatsForUser(req.user);
  }
}
