import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { School } from '../schools/schemas/school.schema';
import { Course } from '../courses/schemas/course.schema';
import { Class } from '../classes/schemas/class.schema';
import { Subscription } from '../plans/schemas/subscription.schema';
// import { Attendance } from '../attendance/schemas/attendance.schema';

interface OverviewStats {
  dateRange: { from: string; to: string };
  totalRevenueCents: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
  occupancyRate: number;
  noShowRate: number;
  avgRetentionDays: number;
  totalActive: number;
  totalDropped: number;
  churnRate: number;
}

interface DimensionMetric {
  id: string;
  name: string;
  value: number;
  context: {
    present?: number;
    absent?: number;
    maxSeats?: number;
    revenueCents?: number;
    active?: number;
    dropped?: number;
  };
}

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_OWNER,
  UserRole.ADMIN,
  UserRole.ADMINISTRATIVE,
)
export class ApiStatsController {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    // @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
  ) {}

  @Get('overview')
  async getOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
    @Request() req?: any,
  ): Promise<OverviewStats> {
    try {
      const fromDate = from
        ? new Date(from)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      // Get basic counts
      const totalUsers = await this.userModel.countDocuments();
      const totalSchools = await this.schoolModel.countDocuments();
      const totalCourses = await this.courseModel.countDocuments();

      // Mock attendance data for now - in a real app, you'd query attendance records
      const mockAttendanceData = {
        totalPresent: 850,
        totalAbsent: 150,
        totalActive: 950,
        totalDropped: 50,
      };

      const attendanceRate =
        mockAttendanceData.totalPresent /
        (mockAttendanceData.totalPresent + mockAttendanceData.totalAbsent);
      const churnRate =
        mockAttendanceData.totalDropped /
        (mockAttendanceData.totalActive + mockAttendanceData.totalDropped);

      return {
        dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
        totalRevenueCents: 125000 * 100, // $1,250 in cents
        totalPresent: mockAttendanceData.totalPresent,
        totalAbsent: mockAttendanceData.totalAbsent,
        attendanceRate,
        occupancyRate: 0.85,
        noShowRate: 0.15,
        avgRetentionDays: 120,
        totalActive: mockAttendanceData.totalActive,
        totalDropped: mockAttendanceData.totalDropped,
        churnRate,
      };
    } catch (error) {
      console.error('Error getting overview stats:', error);
      // Return default stats on error
      return {
        dateRange: {
          from: new Date().toISOString(),
          to: new Date().toISOString(),
        },
        totalRevenueCents: 0,
        totalPresent: 0,
        totalAbsent: 0,
        attendanceRate: 0,
        occupancyRate: 0,
        noShowRate: 0,
        avgRetentionDays: 0,
        totalActive: 0,
        totalDropped: 0,
        churnRate: 0,
      };
    }
  }

  @Get('professors')
  async getProfessors(
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
  ): Promise<DimensionMetric[]> {
    try {
      // Get all teachers/professors
      const teachers = await this.userModel
        .find({
          role: { $in: [UserRole.TEACHER, UserRole.ADMIN] },
        })
        .select('firstName lastName')
        .lean();

      // Mock data - in real app, calculate actual metrics
      return teachers.map((teacher, index) => ({
        id: teacher._id.toString(),
        name: `${teacher.firstName} ${teacher.lastName}`,
        value: this.getMockMetricValue(metric, index),
        context: {
          present: 85 + (index % 10),
          absent: 15 - (index % 5),
          revenueCents: (5000 + index * 500) * 100,
        },
      }));
    } catch (error) {
      console.error('Error getting professor metrics:', error);
      return [];
    }
  }

  @Get('courses')
  async getCourses(
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
  ): Promise<DimensionMetric[]> {
    try {
      const courses = await this.courseModel.find().select('title').lean();

      return courses.map((course, index) => ({
        id: course._id.toString(),
        name: course.title,
        value: this.getMockMetricValue(metric, index),
        context: {
          present: 45 + (index % 15),
          absent: 5 + (index % 3),
          maxSeats: 50,
          revenueCents: (2000 + index * 300) * 100,
        },
      }));
    } catch (error) {
      console.error('Error getting course metrics:', error);
      return [];
    }
  }

  @Get('categories')
  async getCategories(
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
  ): Promise<DimensionMetric[]> {
    // Mock categories data
    const categories = [
      'Ballet',
      'Hip Hop',
      'Contemporary',
      'Jazz',
      'Tap',
      'Salsa',
      'Ballroom',
    ];

    return categories.map((category, index) => ({
      id: `cat-${index}`,
      name: category,
      value: this.getMockMetricValue(metric, index),
      context: {
        present: 30 + (index % 12),
        absent: 5 + (index % 4),
        revenueCents: (1500 + index * 200) * 100,
      },
    }));
  }

  @Get('age-ranges')
  async getAgeRanges(
    @Query('metric') metric: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('academyId') academyId?: string,
  ): Promise<DimensionMetric[]> {
    // Mock age ranges data
    const ageRanges = [
      '3-6 years',
      '7-12 years',
      '13-17 years',
      '18-25 years',
      '26-35 years',
      '36-50 years',
      '50+ years',
    ];

    return ageRanges.map((range, index) => ({
      id: `age-${index}`,
      name: range,
      value: this.getMockMetricValue(metric, index),
      context: {
        present: 25 + (index % 20),
        absent: 3 + (index % 2),
        active: 28 + (index % 18),
        dropped: 2 + (index % 3),
      },
    }));
  }

  private getMockMetricValue(metric: string, index: number): number {
    switch (metric) {
      case 'attendance':
        return 0.8 + (index % 20) / 100; // 80-99%
      case 'occupancy':
        return 0.7 + (index % 25) / 100; // 70-94%
      case 'revenue':
        return (1000 + index * 150) * 100; // Revenue in cents
      case 'no-show':
        return 0.05 + (index % 10) / 100; // 5-14%
      case 'retention':
        return 90 + (index % 30); // 90-119 days
      default:
        return index % 10;
    }
  }
}
