import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { DailySnapshot, DailySnapshotDocument, AggregatedRow } from '../schemas/daily-snapshot.schema';
import { School } from '../../schools/schemas/school.schema';
import { Enrollment } from '../../courses/schemas/enrollment.schema';
import { Attendance } from '../../attendance/schemas/attendance.schema';
import { Course } from '../../courses/schemas/course.schema';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    @InjectModel(DailySnapshot.name) private dailySnapshotModel: Model<DailySnapshotDocument>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
  ) {}

  @Cron('0 30 5 * * *', { name: 'daily-snapshot-generation', timeZone: 'UTC' })
  async generateDailySnapshots(): Promise<void> {
    this.logger.log('Starting daily snapshot generation...');
    
    try {
      const yesterday = this.getYesterday();
      const schools = await this.schoolModel.find({ isActive: true }).exec();
      
      let processedCount = 0;
      let errorCount = 0;

      for (const school of schools) {
        try {
          await this.generateSnapshotForSchool(school._id, yesterday);
          processedCount++;
          this.logger.log(`Snapshot generated for school: ${school.name} (${school._id})`);
        } catch (error) {
          errorCount++;
          this.logger.error(`Failed to generate snapshot for school ${school._id}: ${error.message}`, error.stack);
        }
      }

      this.logger.log(`Daily snapshot generation completed. Processed: ${processedCount}, Errors: ${errorCount}`);
      await this.cleanupOldSnapshots();
      
    } catch (error) {
      this.logger.error('Fatal error in daily snapshot generation:', error.message, error.stack);
    }
  }

  async generateSnapshotForSchool(schoolId: Types.ObjectId | string, date: Date): Promise<DailySnapshot> {
    const academyId = new Types.ObjectId(schoolId);
    
    // Get school to fetch timezone
    const school = await this.schoolModel.findById(academyId).exec();
    const schoolTimezone = school?.timezone || 'America/Bogota';
    
    // Calculate timezone offset in minutes from UTC
    const timezoneOffset = this.getTimezoneOffset(schoolTimezone);
    
    // Convert the input date to the school's timezone to get the correct local date
    const localDate = new Date(date.getTime() - timezoneOffset * 60000);
    const localDateStr = localDate.toISOString().split('T')[0];
    
    // Create start and end of day in the school's timezone
    const [year, month, day] = localDateStr.split('-').map(Number);
    const startOfDayLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDayLocal = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
    // Convert back to UTC for database storage and queries
    const startOfDay = new Date(startOfDayLocal.getTime() + timezoneOffset * 60000);
    const endOfDay = new Date(endOfDayLocal.getTime() + timezoneOffset * 60000);
    
    this.logger.debug(`Generating snapshot for school ${academyId} (${schoolTimezone})`);
    this.logger.debug(`Local date: ${localDateStr}, UTC range: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);

    // Check if snapshot already exists (using the start of local day for consistency)
    const existingSnapshot = await this.dailySnapshotModel.findOne({
      academyId,
      date: startOfDayLocal // Store the local date start for consistency
    }).exec();

    if (existingSnapshot) {
      this.logger.warn(`Snapshot already exists for school ${academyId} on ${localDateStr}`);
      return existingSnapshot;
    }

    // Get all data in parallel
    const [revenueData, attendanceData, enrollmentData, courseData] = await Promise.all([
      this.getRevenueData(academyId, startOfDay, endOfDay),
      this.getAttendanceData(academyId, startOfDay, endOfDay),
      this.getEnrollmentData(academyId, startOfDay),
      this.getCourseData(academyId)
    ]);

    // Calculate metrics
    const totalRevenue = revenueData.reduce((sum, r) => sum + (r.amountCents || 0), 0);
    const presentCount = attendanceData.filter(a => a.present).length;
    const absentCount = attendanceData.filter(a => !a.present).length;
    const activeEnrollments = enrollmentData.filter(e => e.isActive);
    const totalEnrollments = activeEnrollments.length;
    
    // Since you don't have max students per course, use 20% over current enrollment as capacity
    const estimatedMaxSeats = Math.max(totalEnrollments * 1.2, presentCount + absentCount);
    
    // Calculate retention (average days since enrollment for active students)
    const avgRetentionDays = activeEnrollments.length > 0 
      ? Math.round(activeEnrollments.reduce((sum, e) => {
          const daysSinceEnrollment = Math.floor((startOfDay.getTime() - new Date(e.createdAt || e.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
          return sum + daysSinceEnrollment;
        }, 0) / activeEnrollments.length)
      : 0;

    // Count enrollments that became inactive today (no specific dropped status in this schema)
    const droppedToday = enrollmentData.filter(e => 
      !e.isActive && 
      new Date(e.updatedAt) >= startOfDay && 
      new Date(e.updatedAt) <= endOfDay
    ).length;

    // Create snapshot with real data
    const snapshot = new this.dailySnapshotModel({
      academyId,
      date: startOfDayLocal, // Use local date start for consistency
      revenueCents: totalRevenue,
      presentCount,
      absentCount,
      maxSeats: estimatedMaxSeats, // Estimated capacity based on current enrollment + buffer
      activeCount: activeEnrollments.length,
      droppedToday,
      avgRetentionDays,
      byProfessor: await this.getAggregatedByProfessor(academyId, startOfDay, endOfDay),
      byCourse: await this.getAggregatedByCourse(academyId, startOfDay, endOfDay),
      byCategory: await this.getAggregatedByCategory(academyId, startOfDay, endOfDay),
      byAgeRange: [] // Age range would need user birthdates
    });

    return await snapshot.save();
  }

  private getTimezoneOffset(timezone: string): number {
    // Calculate timezone offset in minutes from UTC
    // For common Colombian timezone
    if (timezone === 'America/Bogota' || timezone === 'America/Lima') {
      return -300; // UTC-5 = -300 minutes
    }
    // Add more timezones as needed
    // For now, default to Colombian time
    return -300;
  }

  private async getAttendanceData(academyId: Types.ObjectId, startOfDay: Date, endOfDay: Date) {
    this.logger.debug(`Getting attendance data for academy ${academyId} from ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
    
    // Get attendance data within the timezone-aware date range
    const result = await this.attendanceModel.aggregate([
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
          student: '$student',
          date: '$date',
          courseSchool: { $arrayElemAt: ['$courseInfo.school', 0] }
        }
      }
    ]).exec();
    
    this.logger.debug(`Attendance aggregation result: ${result.length} records`);
    if (result.length > 0) {
      this.logger.debug(`Sample record: ${JSON.stringify(result[0])}`);
      const presentCount = result.filter(r => r.present).length;
      const absentCount = result.filter(r => !r.present).length;
      this.logger.debug(`Present: ${presentCount}, Absent: ${absentCount}`);
    }
    
    return result;
  }

  private async getEnrollmentData(academyId: Types.ObjectId, asOfDate: Date) {
    return await this.enrollmentModel.aggregate([
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
          createdAt: { $lte: asOfDate }
        }
      },
      {
        $project: {
          isActive: '$isActive',
          createdAt: '$createdAt',
          updatedAt: '$updatedAt',
          course: '$course',
          student: '$student'
        }
      }
    ]).exec();
  }

  private async getCourseData(academyId: Types.ObjectId) {
    return await this.courseModel.find({
      school: academyId,
      isActive: true
    }).select('students teacher categories').exec();
  }

  private async getAggregatedByProfessor(academyId: Types.ObjectId, startOfDay: Date, endOfDay: Date): Promise<AggregatedRow[]> {
    const professorData = await this.courseModel.aggregate([
      {
        $match: { school: academyId, isActive: true }
      },
      {
        $lookup: {
          from: 'enrollments',
          localField: '_id',
          foreignField: 'course',
          as: 'enrollments'
        }
      },
      {
        $lookup: {
          from: 'attendances',
          let: { courseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$course', '$$courseId'] },
                date: { $gte: startOfDay, $lte: endOfDay }
              }
            }
          ],
          as: 'attendances'
        }
      },
      {
        $unwind: { path: '$enrollments', preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: { path: '$enrollments.paymentHistory', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: '$teacher',
          totalEnrollments: { $sum: 1 },
          totalAttendances: { $sum: { $size: '$attendances' } },
          presentCount: {
            $sum: {
              $size: {
                $filter: {
                  input: '$attendances',
                  cond: { $eq: ['$$this.present', true] }
                }
              }
            }
          },
          totalRevenue: {
            $sum: {
              $cond: [
                { $and: [
                  { $ne: ['$enrollments.paymentHistory', null] },
                  { $ne: ['$enrollments.paymentHistory.amount', null] }
                ]},
                { $multiply: ['$enrollments.paymentHistory.amount', 100] },
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          id: { $toString: '$_id' },
          revenueCents: '$totalRevenue',
          present: '$presentCount',
          absent: { $subtract: ['$totalAttendances', '$presentCount'] },
          maxSeats: { $multiply: ['$totalEnrollments', 1.2] }, // Assume 20% over current enrollment as capacity
          active: '$totalEnrollments',
          droppedToday: { $literal: 0 },
          avgRetentionDays: { $literal: 30 } // Rough average
        }
      }
    ]).exec();

    return professorData;
  }

  private async getAggregatedByCourse(academyId: Types.ObjectId, startOfDay: Date, endOfDay: Date): Promise<AggregatedRow[]> {
    const courseData = await this.courseModel.aggregate([
      {
        $match: { school: academyId, isActive: true }
      },
      {
        $lookup: {
          from: 'enrollments',
          localField: '_id',
          foreignField: 'course',
          as: 'enrollments'
        }
      },
      {
        $lookup: {
          from: 'attendances',
          let: { courseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$course', '$$courseId'] },
                date: { $gte: startOfDay, $lte: endOfDay }
              }
            }
          ],
          as: 'attendances'
        }
      },
      {
        $addFields: {
          totalRevenue: {
            $sum: {
              $map: {
                input: '$enrollments',
                as: 'enrollment',
                in: {
                  $sum: {
                    $map: {
                      input: { $ifNull: ['$$enrollment.paymentHistory', []] },
                      as: 'payment',
                      in: { $multiply: [{ $ifNull: ['$$payment.amount', 0] }, 100] }
                    }
                  }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          id: { $toString: '$_id' },
          revenueCents: '$totalRevenue',
          present: {
            $size: {
              $filter: {
                input: '$attendances',
                cond: { $eq: ['$$this.present', true] }
              }
            }
          },
          absent: {
            $size: {
              $filter: {
                input: '$attendances',
                cond: { $eq: ['$$this.present', false] }
              }
            }
          },
          maxSeats: { $multiply: [{ $size: '$enrollments' }, 1.2] }, // 20% over current enrollment
          active: { $size: '$enrollments' },
          droppedToday: { $literal: 0 },
          avgRetentionDays: { $literal: 30 }
        }
      }
    ]).exec();

    return courseData;
  }

  private async getAggregatedByCategory(academyId: Types.ObjectId, startOfDay: Date, endOfDay: Date): Promise<AggregatedRow[]> {
    // Similar aggregation for categories - simplified for now
    return [];
  }

  private async getRevenueData(academyId: Types.ObjectId, startOfDay: Date, endOfDay: Date) {
    return await this.enrollmentModel.aggregate([
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
          'courseInfo.school': academyId
        }
      },
      {
        $unwind: { path: '$paymentHistory', preserveNullAndEmptyArrays: true }
      },
      {
        $match: {
          'paymentHistory.date': { $gte: startOfDay, $lte: endOfDay },
          'paymentHistory.amount': { $exists: true, $ne: null }
        }
      },
      {
        $project: {
          enrollmentId: '$_id',
          courseId: { $arrayElemAt: ['$courseInfo._id', 0] },
          teacherId: { $arrayElemAt: ['$courseInfo.teacher', 0] },
          categoryId: { $arrayElemAt: ['$courseInfo.category', 0] },
          studentId: '$student',
          amountCents: { $multiply: ['$paymentHistory.amount', 100] },
          paymentDate: '$paymentHistory.date'
        }
      }
    ]).exec();
  }

  private getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  }

  private async cleanupOldSnapshots(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 18);

    try {
      const result = await this.dailySnapshotModel.deleteMany({
        date: { $lt: cutoffDate }
      }).exec();

      this.logger.log(`Cleaned up ${result.deletedCount} old snapshots older than ${cutoffDate.toISOString()}`);
    } catch (error) {
      this.logger.error('Error cleaning up old snapshots:', error.message, error.stack);
    }
  }

  async generateSnapshotManually(schoolId: string, date?: Date): Promise<DailySnapshot> {
    const targetDate = date || this.getYesterday();
    this.logger.log(`Manually generating snapshot for school ${schoolId} on ${targetDate.toISOString()}`);
    return await this.generateSnapshotForSchool(schoolId, targetDate);
  }
} 