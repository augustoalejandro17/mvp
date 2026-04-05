import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import {
  StatisticsQueryDto,
  MetricQueryDto,
  CourseMetricQueryDto,
  OverviewStatsResponseDto,
  DimensionMetricResponseDto,
  TimeSeriesResponseDto,
} from './dto/statistics.dto';
import { StatisticsFacade } from './services/statistics.facade';

@ApiTags('statistics')
@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(
    private readonly statisticsFacade: StatisticsFacade,
  ) {}

  @Get('overview')
  @Roles(
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get overview statistics' })
  @ApiResponse({ type: OverviewStatsResponseDto })
  async getOverview(
    @Query() query: StatisticsQueryDto,
    @Request() req,
  ): Promise<OverviewStatsResponseDto> {
    return this.statisticsFacade.getOverview(query, req.user);
  }

  @Get('professors')
  @Roles(
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get professor metrics' })
  @ApiResponse({ type: [DimensionMetricResponseDto] })
  async getProfessorMetrics(
    @Query() query: MetricQueryDto,
    @Request() req,
  ): Promise<DimensionMetricResponseDto[]> {
    return this.statisticsFacade.getProfessorMetrics(query, req.user);
  }

  @Get('courses')
  @Roles(
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get course metrics' })
  @ApiResponse({ type: [DimensionMetricResponseDto] })
  async getCourseMetrics(
    @Query() query: MetricQueryDto,
    @Request() req,
  ): Promise<DimensionMetricResponseDto[]> {
    return this.statisticsFacade.getCourseMetrics(query, req.user);
  }

  @Get('courses/timeseries')
  @Roles(
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get course time series data' })
  @ApiResponse({ type: TimeSeriesResponseDto })
  async getCourseTimeSeries(
    @Query() query: CourseMetricQueryDto,
    @Request() req,
  ): Promise<TimeSeriesResponseDto> {
    return this.statisticsFacade.getCourseTimeSeries(query, req.user);
  }

  @Get('categories')
  @Roles(
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get category metrics' })
  @ApiResponse({ type: [DimensionMetricResponseDto] })
  async getCategoryMetrics(
    @Query() query: MetricQueryDto,
    @Request() req,
  ): Promise<DimensionMetricResponseDto[]> {
    return this.statisticsFacade.getCategoryMetrics(query, req.user);
  }

  @Get('age-ranges')
  @Roles(
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Get age range metrics' })
  @ApiResponse({ type: [DimensionMetricResponseDto] })
  async getAgeRangeMetrics(
    @Query() query: MetricQueryDto,
    @Request() req,
  ): Promise<DimensionMetricResponseDto[]> {
    return this.statisticsFacade.getAgeRangeMetrics(query, req.user);
  }

  @Get('admin/generate')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Manually generate snapshot for testing (Admin only)',
  })
  async generateSnapshot(
    @Query('schoolId') schoolId: string,
    @Query('date') date?: string,
  ) {
    return this.statisticsFacade.generateSnapshot(schoolId, date);
  }

  @Get('debug/user')
  @Roles(
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Debug user information' })
  async debugUser(@Request() req): Promise<any> {
    return this.statisticsFacade.getDebugUserPayload(req.user);
  }

  // TEMPORARY: Remove this endpoint after testing
  @Get('test/trigger-cron')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'TESTING: Trigger daily snapshot generation',
  })
  async triggerCronJob(): Promise<any> {
    return this.statisticsFacade.triggerCronJob();
  }

  // TEMPORARY: Remove this endpoint after testing
  @Get('test/generate-historical')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'TESTING: Generate historical snapshots' })
  async generateHistoricalSnapshots(
    @Query('days') days?: string,
  ): Promise<any> {
    return this.statisticsFacade.generateHistoricalSnapshots(days);
  }

  // TEMPORARY: Debug attendance aggregation
  @Get('test/debug-attendance')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'TESTING: Debug attendance aggregation' })
  async debugAttendanceAggregation(@Query('date') date?: string): Promise<any> {
    return this.statisticsFacade.debugAttendanceAggregation(date);
  }
}
