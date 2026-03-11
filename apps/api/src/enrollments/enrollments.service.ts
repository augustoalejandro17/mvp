import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Enrollment, EnrollmentStatus } from './schemas/enrollment.schema';
import { Course } from '../courses/schemas/course.schema';
import { User, UserRole } from '../auth/schemas/user.schema';
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

  private hasSchoolRole(user: User, schoolId: string, role: UserRole): boolean {
    const roleStr = String(role).toLowerCase();
    return (
      user.schoolRoles?.some(
        (item) =>
          item.schoolId?.toString() === schoolId &&
          String(item.role || '').toLowerCase() === roleStr,
      ) || false
    );
  }

  private canManageEnrollment(
    requester: User,
    course: Course,
    schoolId: string,
  ): boolean {
    const requesterRole = String(requester.role || '').toLowerCase();
    const requesterId = (requester as any)._id?.toString();

    if (
      requesterRole === UserRole.SUPER_ADMIN ||
      requesterRole === UserRole.ADMIN
    ) {
      return true;
    }

    if (requesterRole === UserRole.TEACHER) {
      const isMainTeacher =
        !!requesterId && course.teacher?.toString() === requesterId;
      const isSecondaryTeacher =
        course.teachers?.some(
          (teacherId) => !!requesterId && teacherId?.toString() === requesterId,
        ) || false;
      return isMainTeacher || isSecondaryTeacher;
    }

    if (requesterRole === UserRole.SCHOOL_OWNER) {
      const ownsSchool =
        requester.ownedSchools?.some((id) => id.toString() === schoolId) ||
        false;
      return (
        ownsSchool ||
        this.hasSchoolRole(requester, schoolId, UserRole.SCHOOL_OWNER)
      );
    }

    if (requesterRole === UserRole.ADMINISTRATIVE) {
      const administratesSchool =
        requester.administratedSchools?.some(
          (id) => id.toString() === schoolId,
        ) || false;
      return (
        administratesSchool ||
        this.hasSchoolRole(requester, schoolId, UserRole.ADMINISTRATIVE)
      );
    }

    return false;
  }

  private async consumeSeatForEnrollment(
    userId: string,
    schoolId: string,
    courseId: string,
  ): Promise<void> {
    const student = await this.userModel
      .findById(userId)
      .select('courseSeatGrants')
      .exec();
    if (!student) {
      throw new NotFoundException('User not found');
    }

    const studentDoc = student as any;
    const grants = studentDoc.courseSeatGrants || [];
    const grant = grants.find(
      (item) =>
        item.isActive === true &&
        item.schoolId?.toString() === schoolId &&
        item.courseId?.toString() === courseId,
    );

    if (!grant) {
      throw new BadRequestException(
        'Student does not have an active seat assigned for this course',
      );
    }

    if (grant.isConsumed === true) {
      return;
    }

    const quotaOwnerId =
      grant.quotaOwnerId?.toString() || grant.assignedBy?.toString();
    if (quotaOwnerId) {
      const owner = await this.userModel
        .findById(quotaOwnerId)
        .select('role ownerSeatQuotas')
        .exec();

      const ownerRole = owner?.role ? String(owner.role).toLowerCase() : '';
      if (owner && ownerRole === UserRole.SCHOOL_OWNER) {
        const quotas = (owner as any).ownerSeatQuotas || [];
        const quota = quotas.find(
          (item) => item.schoolId?.toString() === schoolId,
        );
        const totalSeats = Number(quota?.totalSeats || 0);

        const usedAgg = await this.userModel.aggregate([
          { $unwind: '$courseSeatGrants' },
          {
            $match: {
              'courseSeatGrants.schoolId': new Types.ObjectId(schoolId),
              'courseSeatGrants.isActive': true,
              'courseSeatGrants.isConsumed': true,
              $or: [
                {
                  'courseSeatGrants.quotaOwnerId': new Types.ObjectId(
                    quotaOwnerId,
                  ),
                },
                {
                  'courseSeatGrants.quotaOwnerId': { $exists: false },
                  'courseSeatGrants.assignedBy': new Types.ObjectId(
                    quotaOwnerId,
                  ),
                },
              ],
            },
          },
          { $count: 'count' },
        ]);
        const usedSeats = usedAgg?.[0]?.count || 0;

        if (usedSeats >= totalSeats) {
          throw new BadRequestException(
            `Seat quota reached. Total: ${totalSeats}, Used: ${usedSeats}`,
          );
        }
      }
    }

    grant.isConsumed = true;
    grant.consumedAt = new Date();
    grant.releasedAt = undefined;
    student.markModified('courseSeatGrants');
    await student.save();
  }

  private async releaseSeatForEnrollment(
    userId: string,
    schoolId: string,
    courseId: string,
  ): Promise<void> {
    const student = await this.userModel
      .findById(userId)
      .select('courseSeatGrants')
      .exec();
    if (!student) return;

    const studentDoc = student as any;
    const grants = studentDoc.courseSeatGrants || [];
    const grant = grants.find(
      (item) =>
        item.isActive === true &&
        item.isConsumed === true &&
        item.schoolId?.toString() === schoolId &&
        item.courseId?.toString() === courseId,
    );
    if (!grant) return;

    grant.isConsumed = false;
    grant.releasedAt = new Date();
    student.markModified('courseSeatGrants');
    await student.save();
  }

  async enrollUser(
    userId: string,
    courseId: string,
    enrolledBy: string,
  ): Promise<Enrollment> {
    try {
      const courseForSeat = await this.courseModel
        .findById(courseId)
        .select('school teacher teachers');
      if (!courseForSeat) {
        throw new NotFoundException('Course not found');
      }
      const schoolId =
        typeof courseForSeat.school === 'object' &&
        courseForSeat.school !== null
          ? (courseForSeat.school as any)._id?.toString() ||
            String(courseForSeat.school)
          : String(courseForSeat.school);

      const requester = await this.userModel.findById(enrolledBy).exec();
      if (!requester) {
        throw new NotFoundException('Requesting user not found');
      }
      const hasPermission = this.canManageEnrollment(
        requester,
        courseForSeat as any,
        schoolId,
      );
      if (!hasPermission) {
        throw new BadRequestException(
          'You do not have permission to enroll users in this course',
        );
      }

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

        await this.consumeSeatForEnrollment(userId, schoolId, courseId);

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

      await this.consumeSeatForEnrollment(userId, schoolId, courseId);

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

    const course = await this.courseModel
      .findById(courseId)
      .select('school teacher teachers');
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    const schoolId =
      typeof course.school === 'object' && course.school !== null
        ? (course.school as any)._id?.toString() || String(course.school)
        : String(course.school);

    const requester = await this.userModel.findById(changedBy).exec();
    if (!requester) {
      throw new NotFoundException('Requesting user not found');
    }
    const hasPermission = this.canManageEnrollment(
      requester,
      course as any,
      schoolId,
    );
    if (!hasPermission) {
      throw new BadRequestException(
        'You do not have permission to update enrollment in this course',
      );
    }

    if (status === EnrollmentStatus.ACTIVE) {
      await this.consumeSeatForEnrollment(userId, schoolId, courseId);
    }
    if (
      status === EnrollmentStatus.INACTIVE ||
      status === EnrollmentStatus.DROPPED
    ) {
      await this.releaseSeatForEnrollment(userId, schoolId, courseId);
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
