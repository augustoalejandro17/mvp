import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CourseMetricQueryDto,
  DimensionMetricResponseDto,
  MetricQueryDto,
  OverviewStatsResponseDto,
  StatisticsQueryDto,
  TimeSeriesResponseDto,
} from '../dto/statistics.dto';
import { SnapshotService } from './snapshot.service';
import { StatisticsService } from './statistics.service';

@Injectable()
export class StatisticsFacade {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly snapshotService: SnapshotService,
  ) {}

  private ensureDebugEndpointAllowed(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException(
        'Debug endpoints are not available in production',
      );
    }
  }

  async getOverview(
    query: StatisticsQueryDto,
    user: any,
  ): Promise<OverviewStatsResponseDto> {
    return this.statisticsService.getOverviewStats(query, user);
  }

  async getProfessorMetrics(
    query: MetricQueryDto,
    user: any,
  ): Promise<DimensionMetricResponseDto[]> {
    return this.statisticsService.getProfessorMetrics(query, user);
  }

  async getCourseMetrics(
    query: MetricQueryDto,
    user: any,
  ): Promise<DimensionMetricResponseDto[]> {
    return this.statisticsService.getCourseMetrics(query, user);
  }

  async getCourseTimeSeries(
    query: CourseMetricQueryDto,
    user: any,
  ): Promise<TimeSeriesResponseDto> {
    return this.statisticsService.getCourseTimeSeries(query, user);
  }

  async getCategoryMetrics(
    query: MetricQueryDto,
    user: any,
  ): Promise<DimensionMetricResponseDto[]> {
    return this.statisticsService.getCategoryMetrics(query, user);
  }

  async getAgeRangeMetrics(
    query: MetricQueryDto,
    user: any,
  ): Promise<DimensionMetricResponseDto[]> {
    return this.statisticsService.getAgeRangeMetrics(query, user);
  }

  async generateSnapshot(schoolId: string, date?: string) {
    const targetDate = date ? new Date(date) : undefined;
    return this.statisticsService.generateSnapshotManually(
      schoolId,
      targetDate,
    );
  }

  getDebugUserPayload(user: any) {
    return {
      message: 'User debug info',
      user: {
        id: user.sub || user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        roleType: typeof user.role,
        schools: user.schools,
        school: user.school,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async triggerCronJob(): Promise<any> {
    try {
      this.ensureDebugEndpointAllowed();
      await this.snapshotService.generateDailySnapshots();
      return {
        success: true,
        message: 'Daily snapshot generation triggered successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async generateHistoricalSnapshots(days?: string): Promise<any> {
    try {
      this.ensureDebugEndpointAllowed();

      const numDays = days ? Number.parseInt(days, 10) : 30;
      if (!Number.isInteger(numDays) || numDays < 1 || numDays > 365) {
        throw new BadRequestException(
          'days must be an integer between 1 and 365',
        );
      }

      const schoolId = '68044f6422ec1bd6922709f4';
      const results = [];

      for (let i = 1; i <= numDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        try {
          await this.statisticsService.generateSnapshotManually(schoolId, date);
          results.push({
            date: date.toISOString().split('T')[0],
            success: true,
          });
        } catch (error) {
          results.push({
            date: date.toISOString().split('T')[0],
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter((result) => result.success).length;

      return {
        success: true,
        message: `Generated ${successCount}/${numDays} snapshots`,
        results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async debugAttendanceAggregation(date?: string): Promise<any> {
    try {
      this.ensureDebugEndpointAllowed();

      const academyId = new Types.ObjectId('68044f6422ec1bd6922709f4');
      const testDate = date ? new Date(date) : new Date('2025-05-27');
      const startOfDay = new Date(testDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(testDate);
      endOfDay.setHours(23, 59, 59, 999);

      const totalAttendance =
        await this.snapshotService['attendanceModel'].countDocuments();

      const attendanceInRange = await this.snapshotService[
        'attendanceModel'
      ].countDocuments({
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      const lookupTest = await this.snapshotService['attendanceModel']
        .aggregate([
          {
            $lookup: {
              from: 'courses',
              localField: 'course',
              foreignField: '_id',
              as: 'courseInfo',
            },
          },
          {
            $match: {
              date: { $gte: startOfDay, $lte: endOfDay },
            },
          },
          {
            $project: {
              present: '$present',
              course: '$course',
              date: '$date',
              courseSchool: { $arrayElemAt: ['$courseInfo.school', 0] },
              courseInfo: '$courseInfo',
            },
          },
        ])
        .exec();

      const withSchoolFilter = await this.snapshotService['attendanceModel']
        .aggregate([
          {
            $lookup: {
              from: 'courses',
              localField: 'course',
              foreignField: '_id',
              as: 'courseInfo',
            },
          },
          {
            $match: {
              'courseInfo.school': academyId,
              date: { $gte: startOfDay, $lte: endOfDay },
            },
          },
          {
            $project: {
              present: '$present',
              course: '$course',
              date: '$date',
              courseSchool: { $arrayElemAt: ['$courseInfo.school', 0] },
            },
          },
        ])
        .exec();

      return {
        success: true,
        debug: {
          academyId: academyId.toString(),
          testDate: testDate.toISOString().split('T')[0],
          dateRange: {
            start: startOfDay.toISOString(),
            end: endOfDay.toISOString(),
          },
          totalAttendance,
          attendanceInRange,
          lookupTestCount: lookupTest.length,
          lookupSample: lookupTest.length > 0 ? lookupTest[0] : null,
          withSchoolFilterCount: withSchoolFilter.length,
          withSchoolFilterSample:
            withSchoolFilter.length > 0 ? withSchoolFilter[0] : null,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
