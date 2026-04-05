import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { ApiStatsFacade } from '../services/api-stats.facade';

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_OWNER,
  UserRole.ADMIN,
  UserRole.ADMINISTRATIVE,
)
export class ApiStatsController {
  constructor(private readonly apiStatsFacade: ApiStatsFacade) {}

  @Get('overview')
  async getOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
    @Request() req?: any,
  ) {
    return this.apiStatsFacade.getOverview(from, to);
  }

  @Get('professors')
  async getProfessors(
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
  ) {
    return this.apiStatsFacade.getProfessors(metric);
  }

  @Get('courses')
  async getCourses(
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
  ) {
    return this.apiStatsFacade.getCourses(metric);
  }

  @Get('categories')
  async getCategories(
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
  ) {
    return this.apiStatsFacade.getCategories(metric);
  }

  @Get('age-ranges')
  async getAgeRanges(
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
  ) {
    return this.apiStatsFacade.getAgeRanges(metric);
  }
}
