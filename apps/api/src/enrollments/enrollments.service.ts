import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Enrollment, EnrollmentStatus } from './schemas/enrollment.schema';
import { Course } from '../courses/schemas/course.schema';
import { User } from '../auth/schemas/user.schema';
import { GamificationIntegrationService } from '../gamification/services/gamification-integration.service';
import { UserProgressService } from '../progress/services/user-progress.service';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly gamificationIntegrationService: GamificationIntegrationService,
    private readonly userProgressService: UserProgressService,
  ) {}

  async enrollUser(
    userId: string,
    courseId: string,
    enrolledBy: string,
  ): Promise<Enrollment> {
    try {
      // Check if enrollment already exists
      const existingEnrollment = await this.enrollmentModel.findOne({
        userId,
        courseId,
      });

      if (existingEnrollment) {
        if (existingEnrollment.status === EnrollmentStatus.ACTIVE) {
          throw new BadRequestException(
            'User is already enrolled in this course',
          );
        }

        // Reactivate existing enrollment
        existingEnrollment.status = EnrollmentStatus.ACTIVE;
        existingEnrollment.statusHistory.push({
          status: EnrollmentStatus.ACTIVE,
          changedAt: new Date(),
          changedBy: enrolledBy,
          reason: 'Re-enrolled',
        });

        return existingEnrollment.save();
      }

      // Create new enrollment
      const enrollment = new this.enrollmentModel({
        userId,
        courseId,
        status: EnrollmentStatus.ACTIVE,
        statusHistory: [
          {
            status: EnrollmentStatus.ACTIVE,
            changedAt: new Date(),
            changedBy: enrolledBy,
            reason: 'Initial enrollment',
          },
        ],
      });

      const savedEnrollment = await enrollment.save();

      // Initialize progress tracking for the new enrollment
      const course = await this.courseModel
        .findById(courseId)
        .populate('school');
      if (course && course.school) {
        await this.userProgressService.initializeCourseProgress(
          userId,
          courseId,
          (course.school as any)._id.toString(),
        );
      }

      return savedEnrollment;
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException(
          'User is already enrolled in this course',
        );
      }
      throw error;
    }
  }

  async updateEnrollmentStatus(
    userId: string,
    courseId: string,
    status: EnrollmentStatus,
    changedBy: string,
    reason?: string,
  ): Promise<Enrollment> {
    const enrollment = await this.enrollmentModel.findOne({ userId, courseId });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    enrollment.status = status;

    if (status === EnrollmentStatus.COMPLETED) {
      enrollment.completedAt = new Date();

      // Award gamification points for course completion
      await this.awardCourseCompletionPoints(enrollment);
    }

    enrollment.statusHistory.push({
      status,
      changedAt: new Date(),
      changedBy,
      reason,
    });

    return enrollment.save();
  }

  async getUserEnrollments(
    userId: string,
    includeInactive: boolean = false,
  ): Promise<Enrollment[]> {
    const filter: any = { userId };

    if (!includeInactive) {
      filter.status = EnrollmentStatus.ACTIVE;
    }

    return this.enrollmentModel
      .find(filter)
      .populate('courseId')
      .sort({ enrolledAt: -1 });
  }

  async getCourseEnrollments(
    courseId: string,
    includeInactive: boolean = false,
  ): Promise<Enrollment[]> {
    const filter: any = { courseId };

    if (!includeInactive) {
      filter.status = EnrollmentStatus.ACTIVE;
    }

    return this.enrollmentModel
      .find(filter)
      .populate('userId')
      .sort({ enrolledAt: -1 });
  }

  async getEnrollmentStats(courseId: string): Promise<any> {
    const stats = await this.enrollmentModel.aggregate([
      { $match: { courseId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await this.enrollmentModel.countDocuments({ courseId });
    const active =
      stats.find((s) => s._id === EnrollmentStatus.ACTIVE)?.count || 0;
    const completed =
      stats.find((s) => s._id === EnrollmentStatus.COMPLETED)?.count || 0;
    const dropped =
      stats.find((s) => s._id === EnrollmentStatus.DROPPED)?.count || 0;

    return {
      total,
      active,
      completed,
      dropped,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      dropoutRate: total > 0 ? (dropped / total) * 100 : 0,
    };
  }

  async deleteEnrollment(userId: string, courseId: string): Promise<void> {
    await this.enrollmentModel.deleteOne({ userId, courseId });
  }

  /**
   * Award gamification points for course completion using real progress data
   */
  private async awardCourseCompletionPoints(
    enrollment: Enrollment,
  ): Promise<void> {
    try {
      // Get course information
      const course = await this.courseModel
        .findById(enrollment.courseId)
        .populate('school');
      if (!course || !course.school) {
        this.logger.warn(
          `Course ${enrollment.courseId} or school not found for completion gamification`,
        );
        return;
      }

      // Get real progress data from UserProgressService
      const progressSummary =
        await this.userProgressService.getUserCourseProgress(
          enrollment.userId.toString(),
          enrollment.courseId.toString(),
        );

      if (!progressSummary) {
        this.logger.warn(
          `No progress data found for user ${enrollment.userId} in course ${enrollment.courseId}`,
        );
        return;
      }

      // Use real completion data
      const totalClasses = progressSummary.totalClasses || 1;
      const attendedClasses = progressSummary.attendedClasses;
      const averageScore = progressSummary.averageVideoWatchPercentage || 85;

      await this.gamificationIntegrationService.handleCourseCompletion(
        enrollment.userId.toString(),
        (course.school as any)._id.toString(),
        enrollment.courseId.toString(),
        {
          title: course.title,
          totalClasses,
          attendedClasses,
          averageScore,
          certificateEarned: progressSummary.completionPercentage >= 80, // Certificate earned if 80%+ completion
        },
      );

      this.logger.log(
        `Gamification points awarded for course completion: ${enrollment.courseId} (${progressSummary.completionPercentage}% completion)`,
      );
    } catch (error) {
      this.logger.error(
        `Error awarding course completion points: ${error.message}`,
      );
      // Don't throw error to avoid breaking enrollment update
    }
  }
}
