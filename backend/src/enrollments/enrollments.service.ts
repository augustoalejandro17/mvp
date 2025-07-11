import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Enrollment, EnrollmentStatus } from './schemas/enrollment.schema';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
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

      return enrollment.save();
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
}
