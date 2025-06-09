import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DailySnapshot, DailySnapshotDocument } from '../schemas/daily-snapshot.schema';
import { SnapshotService } from './snapshot.service';
import { User } from '../../auth/schemas/user.schema';
import { Course } from '../../courses/schemas/course.schema';
import { Category } from '../../categories/schemas/category.schema';
import { School } from '../../schools/schemas/school.schema';
import {
  StatisticsQueryDto,
  MetricQueryDto,
  CourseMetricQueryDto,
  OverviewStatsResponseDto,
  DimensionMetricResponseDto,
  TimeSeriesResponseDto,
  TimeSeriesDataPointDto,
  MetricType
} from '../dto/statistics.dto';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(DailySnapshot.name) private dailySnapshotModel: Model<DailySnapshotDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    private snapshotService: SnapshotService,
  ) {}

  async getOverviewStats(query: StatisticsQueryDto, user: any): Promise<OverviewStatsResponseDto> {
    const { from, to, academyIds } = await this.validateAndParseQuery(query, user);
    
    const snapshots = await this.dailySnapshotModel.find({
      academyId: { $in: academyIds },
      date: { $gte: from, $lte: to }
    }).exec();

    if (snapshots.length === 0) {
      return this.createEmptyOverviewStats(from, to);
    }

    const aggregated = this.aggregateSnapshots(snapshots);
    
    return {
      dateRange: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
      totalRevenueCents: aggregated.revenueCents,
      totalPresent: aggregated.presentCount,
      totalAbsent: aggregated.absentCount,
      attendanceRate: this.calculateAttendanceRate(aggregated.presentCount, aggregated.absentCount),
      occupancyRate: this.calculateOccupancyRate(aggregated.presentCount, aggregated.maxSeats),
      noShowRate: this.calculateNoShowRate(aggregated.presentCount, aggregated.absentCount),
      avgRetentionDays: aggregated.avgRetentionDays,
      totalActive: aggregated.activeCount,
      totalDropped: aggregated.droppedToday,
      churnRate: this.calculateChurnRate(aggregated.droppedToday, aggregated.activeCount)
    };
  }

  async getProfessorMetrics(query: MetricQueryDto, user: any): Promise<DimensionMetricResponseDto[]> {
    const { from, to, academyIds } = await this.validateAndParseQuery(query, user);
    
    const snapshots = await this.dailySnapshotModel.find({
      academyId: { $in: academyIds },
      date: { $gte: from, $lte: to }
    }).exec();

    const professorMap = new Map<string, any>();
    
    snapshots.forEach(snapshot => {
      snapshot.byProfessor.forEach(prof => {
        if (!professorMap.has(prof.id)) {
          professorMap.set(prof.id, {
            revenueCents: 0,
            present: 0,
            absent: 0,
            maxSeats: 0,
            active: 0,
            dropped: 0,
            retentionSum: 0,
            retentionCount: 0
          });
        }
        
        const existing = professorMap.get(prof.id);
        existing.revenueCents += prof.revenueCents;
        existing.present += prof.present;
        existing.absent += prof.absent;
        existing.maxSeats += prof.maxSeats;
        existing.active += prof.active;
        existing.dropped += prof.droppedToday;
        if (prof.avgRetentionDays > 0) {
          existing.retentionSum += prof.avgRetentionDays * prof.active;
          existing.retentionCount += prof.active;
        }
      });
    });

    const professorIds = Array.from(professorMap.keys()).filter(id => id !== 'null' && id !== 'undefined');
    const professors = await this.userModel.find({ _id: { $in: professorIds } }).exec();
    const professorNames = new Map(professors.map(p => [p._id.toString(), p.name]));

    return Array.from(professorMap.entries()).map(([id, data]) => ({
      id,
      name: professorNames.get(id) || 'Unknown Professor',
      value: this.calculateMetricValue(query.metric, data),
      context: {
        present: data.present,
        absent: data.absent,
        maxSeats: data.maxSeats,
        revenueCents: data.revenueCents,
        active: data.active,
        dropped: data.dropped
      }
    }));
  }

  async getCourseMetrics(query: MetricQueryDto, user: any): Promise<DimensionMetricResponseDto[]> {
    const { from, to, academyIds } = await this.validateAndParseQuery(query, user);
    
    const snapshots = await this.dailySnapshotModel.find({
      academyId: { $in: academyIds },
      date: { $gte: from, $lte: to }
    }).exec();

    const courseMap = new Map<string, any>();
    
    snapshots.forEach(snapshot => {
      snapshot.byCourse.forEach(course => {
        if (!courseMap.has(course.id)) {
          courseMap.set(course.id, {
            revenueCents: 0,
            present: 0,
            absent: 0,
            maxSeats: 0,
            active: 0,
            dropped: 0
          });
        }
        
        const existing = courseMap.get(course.id);
        existing.revenueCents += course.revenueCents;
        existing.present += course.present;
        existing.absent += course.absent;
        existing.maxSeats += course.maxSeats;
        existing.active += course.active;
        existing.dropped += course.droppedToday;
      });
    });

    const courseIds = Array.from(courseMap.keys()).filter(id => id !== 'null' && id !== 'undefined');
    const courses = await this.courseModel.find({ _id: { $in: courseIds } }).exec();
    const courseNames = new Map(courses.map(c => [c._id.toString(), c.title]));

    return Array.from(courseMap.entries()).map(([id, data]) => ({
      id,
      name: courseNames.get(id) || 'Unknown Course',
      value: this.calculateMetricValue(query.metric, data),
      context: {
        present: data.present,
        absent: data.absent,
        maxSeats: data.maxSeats,
        revenueCents: data.revenueCents,
        active: data.active,
        dropped: data.dropped
      }
    }));
  }

  async getCourseTimeSeries(query: CourseMetricQueryDto, user: any): Promise<TimeSeriesResponseDto> {
    const { from, to, academyIds } = await this.validateAndParseQuery(query, user);
    
    const snapshots = await this.dailySnapshotModel.find({
      academyId: { $in: academyIds },
      date: { $gte: from, $lte: to }
    }).sort({ date: 1 }).exec();

    const dataPoints: TimeSeriesDataPointDto[] = [];
    
    snapshots.forEach(snapshot => {
      const courseData = snapshot.byCourse.find(c => c.id === query.courseId);
      if (courseData) {
        dataPoints.push({
          date: snapshot.date.toISOString().split('T')[0],
          value: this.calculateMetricValue(query.metric, courseData),
          context: {
            present: courseData.present,
            absent: courseData.absent,
            maxSeats: courseData.maxSeats,
            revenueCents: courseData.revenueCents,
            active: courseData.active,
            dropped: courseData.droppedToday
          }
        });
      }
    });

    return {
      metric: query.metric,
      dateRange: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
      data: dataPoints
    };
  }

  async getCategoryMetrics(query: MetricQueryDto, user: any): Promise<DimensionMetricResponseDto[]> {
    const { from, to, academyIds } = await this.validateAndParseQuery(query, user);
    
    const snapshots = await this.dailySnapshotModel.find({
      academyId: { $in: academyIds },
      date: { $gte: from, $lte: to }
    }).exec();

    const categoryMap = new Map<string, any>();
    
    snapshots.forEach(snapshot => {
      snapshot.byCategory.forEach(category => {
        if (!categoryMap.has(category.id)) {
          categoryMap.set(category.id, {
            revenueCents: 0,
            present: 0,
            absent: 0,
            maxSeats: 0,
            active: 0,
            dropped: 0
          });
        }
        
        const existing = categoryMap.get(category.id);
        existing.revenueCents += category.revenueCents;
        existing.present += category.present;
        existing.absent += category.absent;
        existing.maxSeats += category.maxSeats;
        existing.active += category.active;
        existing.dropped += category.droppedToday;
      });
    });

    const categoryIds = Array.from(categoryMap.keys()).filter(id => id !== 'null' && id !== 'undefined' && id !== 'uncategorized');
    const categories = await this.categoryModel.find({ _id: { $in: categoryIds } }).exec();
    const categoryNames = new Map(categories.map(c => [c._id.toString(), c.name]));

    return Array.from(categoryMap.entries()).map(([id, data]) => ({
      id,
      name: id === 'uncategorized' ? 'Uncategorized' : (categoryNames.get(id) || 'Unknown Category'),
      value: this.calculateMetricValue(query.metric, data),
      context: {
        present: data.present,
        absent: data.absent,
        maxSeats: data.maxSeats,
        revenueCents: data.revenueCents,
        active: data.active,
        dropped: data.dropped
      }
    }));
  }

  async getAgeRangeMetrics(query: MetricQueryDto, user: any): Promise<DimensionMetricResponseDto[]> {
    const { from, to, academyIds } = await this.validateAndParseQuery(query, user);
    
    const snapshots = await this.dailySnapshotModel.find({
      academyId: { $in: academyIds },
      date: { $gte: from, $lte: to }
    }).exec();

    const ageRangeMap = new Map<string, any>();
    
    snapshots.forEach(snapshot => {
      snapshot.byAgeRange.forEach(range => {
        if (!ageRangeMap.has(range.id)) {
          ageRangeMap.set(range.id, {
            revenueCents: 0,
            present: 0,
            absent: 0,
            maxSeats: 0,
            active: 0,
            dropped: 0
          });
        }
        
        const existing = ageRangeMap.get(range.id);
        existing.revenueCents += range.revenueCents;
        existing.present += range.present;
        existing.absent += range.absent;
        existing.maxSeats += range.maxSeats;
        existing.active += range.active;
        existing.dropped += range.droppedToday;
      });
    });

    return Array.from(ageRangeMap.entries()).map(([id, data]) => ({
      id,
      name: id === 'unknown' ? 'Unknown Age' : `${id} years`,
      value: this.calculateMetricValue(query.metric, data),
      context: {
        present: data.present,
        absent: data.absent,
        maxSeats: data.maxSeats,
        revenueCents: data.revenueCents,
        active: data.active,
        dropped: data.dropped
      }
    }));
  }

  async generateSnapshotManually(schoolId: string, date?: Date) {
    return this.snapshotService.generateSnapshotManually(schoolId, date);
  }

  private async validateAndParseQuery(query: StatisticsQueryDto, user: any) {
    // TEMPORARY: Super admin bypass - check for any super admin variation
    const userRoleStr = String(user.role || '').toLowerCase();
    if (userRoleStr.includes('super') || userRoleStr.includes('admin')) {
      const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = query.to ? new Date(query.to) : new Date();
      
      let academyIds: Types.ObjectId[] = [];
      if (query.academyId) {
        academyIds = [new Types.ObjectId(query.academyId)];
      } else {
        const allSchools = await this.dailySnapshotModel.distinct('academyId').exec();
        academyIds = allSchools;
      }
      
      return { from, to, academyIds };
    }
    
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();
    
    if (from > to) {
      throw new BadRequestException('From date cannot be after to date');
    }

    let academyIds: Types.ObjectId[] = [];
    
    // Import UserRole enum values
    const UserRole = {
      SUPER_ADMIN: 'super_admin',
      SCHOOL_OWNER: 'school_owner',
      ADMINISTRATIVE: 'administrative',
      ADMIN: 'admin'
    };
    
    // Normalize role for comparison (handle case variations)
    const normalizedUserRole = String(user.role).toLowerCase();
    
    if (normalizedUserRole === UserRole.SUPER_ADMIN || normalizedUserRole === 'super_admin') {
      if (query.academyId) {
        academyIds = [new Types.ObjectId(query.academyId)];
      } else {
        // Get all academies for super admin if no specific academy requested
        const allSchools = await this.dailySnapshotModel.distinct('academyId').exec();
        academyIds = allSchools;
      }
    } else if (user.role === UserRole.SCHOOL_OWNER) {
      // For school owners, get schools they own by checking school.admin field
      const userId = user.sub || (user._id ? user._id.toString() : null);
      if (!userId) {
        throw new ForbiddenException('User ID not found');
      }
      
      // If specific academyId requested, verify access
      if (query.academyId) {
        const hasAccess = await this.checkSchoolAccess(user, query.academyId);
        if (!hasAccess) {
          throw new ForbiddenException('No access to requested school');
        }
        academyIds = [new Types.ObjectId(query.academyId)];
      } else {
        // Get all schools they own - we need to import School model for this
        // For now, if no specific school, require academyId parameter
        throw new BadRequestException('School owners must specify academyId parameter');
      }
    } else if (user.role === UserRole.ADMINISTRATIVE || user.role === UserRole.ADMIN) {
      // For administrative users, check if they have access to the school
      const userId = user.sub || (user._id ? user._id.toString() : null);
      if (!userId) {
        throw new ForbiddenException('User ID not found');
      }
      
      if (query.academyId) {
        const hasAccess = await this.checkSchoolAccess(user, query.academyId);
        if (!hasAccess) {
          throw new ForbiddenException('No access to requested school');
        }
        academyIds = [new Types.ObjectId(query.academyId)];
      } else {
        throw new BadRequestException('Administrative users must specify academyId parameter');
      }
    } else {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (academyIds.length === 0) {
      throw new ForbiddenException('No accessible schools found');
    }
    return { from, to, academyIds };
  }

  private async checkSchoolAccess(user: any, schoolId: string): Promise<boolean> {
    const userId = user.sub || (user._id ? user._id.toString() : null);
    if (!userId) {
      return false;
    }
    
    // Import UserRole enum values
    const UserRole = {
      SUPER_ADMIN: 'super_admin',
      SCHOOL_OWNER: 'school_owner',
      ADMINISTRATIVE: 'administrative',
      ADMIN: 'admin'
    };
    
    if (user.role === UserRole.SUPER_ADMIN) {
      return true; // Super admin has access to all schools
    }
    
    try {
      const school = await this.schoolModel.findById(schoolId).exec();
      if (!school) {
        return false;
      }
      
      // Check if user is admin of the school
      const isAdmin = school.admin && school.admin.toString() === userId;
      
      // Check if user is teacher in the school
      const isTeacher = school.teachers && school.teachers.some(teacherId => 
        teacherId && teacherId.toString() === userId
      );
      
      // Check if user is administrative in the school
      const isAdministrative = school.administratives && school.administratives.some(adminId => 
        adminId && adminId.toString() === userId
      );
      
      // Role-based access control
      if (user.role === UserRole.SCHOOL_OWNER) return isAdmin;
      if (user.role === UserRole.ADMIN) return isAdmin || isTeacher;
      if (user.role === UserRole.ADMINISTRATIVE) return isAdministrative;
      
      return isAdmin || isTeacher || isAdministrative;
    } catch (error) {
      return false;
    }
  }

  private aggregateSnapshots(snapshots: DailySnapshot[]) {
    return snapshots.reduce((acc, snapshot) => ({
      revenueCents: acc.revenueCents + snapshot.revenueCents,
      presentCount: acc.presentCount + snapshot.presentCount,
      absentCount: acc.absentCount + snapshot.absentCount,
      maxSeats: acc.maxSeats + snapshot.maxSeats,
      activeCount: acc.activeCount + snapshot.activeCount,
      droppedToday: acc.droppedToday + snapshot.droppedToday,
      avgRetentionDays: acc.avgRetentionDays + snapshot.avgRetentionDays
    }), {
      revenueCents: 0,
      presentCount: 0,
      absentCount: 0,
      maxSeats: 0,
      activeCount: 0,
      droppedToday: 0,
      avgRetentionDays: 0
    });
  }

  private calculateMetricValue(metric: MetricType, data: any): number {
    switch (metric) {
      case MetricType.ATTENDANCE:
        return this.calculateAttendanceRate(data.present, data.absent);
      case MetricType.OCCUPANCY:
        return this.calculateOccupancyRate(data.present, data.maxSeats);
      case MetricType.REVENUE:
        return data.revenueCents;
      case MetricType.NO_SHOW:
        return this.calculateNoShowRate(data.present, data.absent);
      case MetricType.RETENTION:
        return data.retentionCount > 0 ? data.retentionSum / data.retentionCount : 0;
      default:
        return 0;
    }
  }

  private calculateAttendanceRate(present: number, absent: number): number {
    const total = present + absent;
    return total > 0 ? present / total : 0;
  }

  private calculateOccupancyRate(present: number, maxSeats: number): number {
    return maxSeats > 0 ? present / maxSeats : 0;
  }

  private calculateNoShowRate(present: number, absent: number): number {
    const total = present + absent;
    return total > 0 ? absent / total : 0;
  }

  private calculateChurnRate(dropped: number, active: number): number {
    const total = dropped + active;
    return total > 0 ? dropped / total : 0;
  }

  private createEmptyOverviewStats(from: Date, to: Date): OverviewStatsResponseDto {
    return {
      dateRange: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
      totalRevenueCents: 0,
      totalPresent: 0,
      totalAbsent: 0,
      attendanceRate: 0,
      occupancyRate: 0,
      noShowRate: 0,
      avgRetentionDays: 0,
      totalActive: 0,
      totalDropped: 0,
      churnRate: 0
    };
  }
} 