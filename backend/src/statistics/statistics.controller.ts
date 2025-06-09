import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
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
  TimeSeriesResponseDto
} from './dto/statistics.dto';
import { StatisticsService } from './services/statistics.service';
import { SnapshotService } from './services/snapshot.service';

@ApiTags('statistics')
@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly snapshotService: SnapshotService
  ) {}

  @Get('overview')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get overview statistics' })
  @ApiResponse({ type: OverviewStatsResponseDto })
  async getOverview(@Query() query: StatisticsQueryDto, @Request() req): Promise<OverviewStatsResponseDto> {
    return await this.statisticsService.getOverviewStats(query, req.user);
  }

  @Get('professors')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get professor metrics' })
  @ApiResponse({ type: [DimensionMetricResponseDto] })
  async getProfessorMetrics(@Query() query: MetricQueryDto, @Request() req): Promise<DimensionMetricResponseDto[]> {
    return await this.statisticsService.getProfessorMetrics(query, req.user);
  }

  @Get('courses')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get course metrics' })
  @ApiResponse({ type: [DimensionMetricResponseDto] })
  async getCourseMetrics(@Query() query: MetricQueryDto, @Request() req): Promise<DimensionMetricResponseDto[]> {
    return await this.statisticsService.getCourseMetrics(query, req.user);
  }

  @Get('courses/timeseries')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get course time series data' })
  @ApiResponse({ type: TimeSeriesResponseDto })
  async getCourseTimeSeries(@Query() query: CourseMetricQueryDto, @Request() req): Promise<TimeSeriesResponseDto> {
    return await this.statisticsService.getCourseTimeSeries(query, req.user);
  }

  @Get('categories')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get category metrics' })
  @ApiResponse({ type: [DimensionMetricResponseDto] })
  async getCategoryMetrics(@Query() query: MetricQueryDto, @Request() req): Promise<DimensionMetricResponseDto[]> {
    return await this.statisticsService.getCategoryMetrics(query, req.user);
  }

  @Get('age-ranges')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get age range metrics' })
  @ApiResponse({ type: [DimensionMetricResponseDto] })
  async getAgeRangeMetrics(@Query() query: MetricQueryDto, @Request() req): Promise<DimensionMetricResponseDto[]> {
    return await this.statisticsService.getAgeRangeMetrics(query, req.user);
  }

  @Get('admin/generate')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Manually generate snapshot for testing (Admin only)' })
  async generateSnapshot(@Query('schoolId') schoolId: string, @Query('date') date?: string) {
    const targetDate = date ? new Date(date) : undefined;
    return await this.statisticsService.generateSnapshotManually(schoolId, targetDate);
  }

  @Get('debug/user')
  @Roles(UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Debug user information' })
  async debugUser(@Request() req): Promise<any> {
    return {
      message: 'User debug info',
      user: {
        id: req.user.sub || req.user._id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        roleType: typeof req.user.role,
        schools: req.user.schools,
        school: req.user.school
      },
      timestamp: new Date().toISOString()
    };
  }

  // TEMPORARY: Remove this endpoint after testing
  @Get('test/trigger-cron')
  @UseGuards()
  @ApiOperation({ summary: 'TESTING: Trigger daily snapshot generation (NO AUTH)' })
  async triggerCronJob(): Promise<any> {
    try {
      console.log('🚀 Manually triggering cron job...');
      await this.snapshotService.generateDailySnapshots();
      return {
        success: true,
        message: 'Daily snapshot generation triggered successfully',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error triggering cron job:', error);
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // TEMPORARY: Remove this endpoint after testing  
  @Get('test/generate-historical')
  @UseGuards()
  @ApiOperation({ summary: 'TESTING: Generate historical snapshots (NO AUTH)' })
  async generateHistoricalSnapshots(@Query('days') days?: string): Promise<any> {
    try {
      const numDays = parseInt(days || '30');
      const schoolId = '68044f6422ec1bd6922709f4'; // Mambuco school
      const results = [];
      
      console.log(`🚀 Generating ${numDays} days of historical snapshots...`);
      
      for (let i = 1; i <= numDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        try {
          const snapshot = await this.statisticsService.generateSnapshotManually(schoolId, date);
          results.push({
            date: date.toISOString().split('T')[0],
            success: true
          });
          console.log(`✅ Generated snapshot for ${date.toISOString().split('T')[0]}`);
        } catch (error) {
          results.push({
            date: date.toISOString().split('T')[0],
            success: false,
            error: error.message
          });
          console.log(`❌ Failed for ${date.toISOString().split('T')[0]}: ${error.message}`);
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      
      return {
        success: true,
        message: `Generated ${successCount}/${numDays} snapshots`,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error generating historical snapshots:', error);
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // TEMPORARY: Debug attendance aggregation
  @Get('test/debug-attendance')
  @UseGuards()
  @ApiOperation({ summary: 'TESTING: Debug attendance aggregation (NO AUTH)' })
  async debugAttendanceAggregation(@Query('date') date?: string): Promise<any> {
    try {
      const mongoose = require('mongoose');
      const academyId = new mongoose.Types.ObjectId('68044f6422ec1bd6922709f4');
      const testDate = date ? new Date(date) : new Date('2025-05-27');
      const startOfDay = new Date(testDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(testDate);
      endOfDay.setHours(23, 59, 59, 999);

      console.log(`🔍 Debugging attendance for ${testDate.toISOString().split('T')[0]}`);

      // Test 1: Total attendance count
      const totalAttendance = await this.snapshotService['attendanceModel'].countDocuments();
      
      // Test 2: Attendance in date range
      const attendanceInRange = await this.snapshotService['attendanceModel'].countDocuments({
        date: { $gte: startOfDay, $lte: endOfDay }
      });
      
      // Test 3: Test the lookup without school filter
      const lookupTest = await this.snapshotService['attendanceModel'].aggregate([
        {
          $lookup: {
            from: 'courses',
            localField: 'course',
            foreignField: '_id',
            as: 'courseInfo'
          }
        },
        {
          $match: {
            date: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $project: {
            present: '$present',
            course: '$course',
            date: '$date',
            courseSchool: { $arrayElemAt: ['$courseInfo.school', 0] },
            courseInfo: '$courseInfo'
          }
        }
      ]).exec();
      
      // Test 4: Test with school filter
      const withSchoolFilter = await this.snapshotService['attendanceModel'].aggregate([
        {
          $lookup: {
            from: 'courses',
            localField: 'course',
            foreignField: '_id',
            as: 'courseInfo'
          }
        },
        {
          $match: {
            'courseInfo.school': academyId,
            date: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $project: {
            present: '$present',
            course: '$course',
            date: '$date',
            courseSchool: { $arrayElemAt: ['$courseInfo.school', 0] }
          }
        }
      ]).exec();

      return {
        success: true,
        debug: {
          academyId: academyId.toString(),
          testDate: testDate.toISOString().split('T')[0],
          dateRange: {
            start: startOfDay.toISOString(),
            end: endOfDay.toISOString()
          },
          totalAttendance,
          attendanceInRange,
          lookupTestCount: lookupTest.length,
          lookupSample: lookupTest.length > 0 ? lookupTest[0] : null,
          withSchoolFilterCount: withSchoolFilter.length,
          withSchoolFilterSample: withSchoolFilter.length > 0 ? withSchoolFilter[0] : null
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error debugging attendance:', error);
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
} 