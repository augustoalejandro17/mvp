import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { School } from '../schools/schemas/school.schema';
import { Course } from '../courses/schemas/course.schema';
import { Class } from '../classes/schemas/class.schema';
import { Subscription } from '../plans/schemas/subscription.schema';

export interface OverviewStats {
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

export interface DimensionMetric {
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

@Injectable()
export class ApiStatsFacade {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
  ) {}

  async getOverview(from?: string, to?: string): Promise<OverviewStats> {
    try {
      const fromDate = from
        ? new Date(from)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      await Promise.all([
        this.userModel.countDocuments(),
        this.schoolModel.countDocuments(),
        this.courseModel.countDocuments(),
        this.classModel.countDocuments(),
        this.subscriptionModel.countDocuments(),
      ]);

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
        totalRevenueCents: 125000 * 100,
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
    } catch {
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

  async getProfessors(metric: string): Promise<DimensionMetric[]> {
    try {
      const teachers = await this.userModel
        .find({
          role: { $in: ['teacher', 'admin'] },
        })
        .select('firstName lastName')
        .lean();

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
    } catch {
      return [];
    }
  }

  async getCourses(metric: string): Promise<DimensionMetric[]> {
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
    } catch {
      return [];
    }
  }

  getCategories(metric: string): DimensionMetric[] {
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

  getAgeRanges(metric: string): DimensionMetric[] {
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
        return 0.8 + (index % 20) / 100;
      case 'occupancy':
        return 0.7 + (index % 25) / 100;
      case 'revenue':
        return (1000 + index * 150) * 100;
      case 'no-show':
        return 0.05 + (index % 10) / 100;
      case 'retention':
        return 90 + (index % 30);
      default:
        return index % 10;
    }
  }
}
