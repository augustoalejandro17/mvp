import { Injectable } from '@nestjs/common';
import { EnrollmentStatus } from '../schemas/enrollment.schema';
import { EnrollmentsService } from '../enrollments.service';

@Injectable()
export class EnrollmentsFacade {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  async enrollUser(
    body: { userId: string; courseId: string },
    req: any,
  ) {
    const enrollment = await this.enrollmentsService.enrollUser(
      body.userId,
      body.courseId,
      req.user.id,
    );
    return { success: true, enrollment };
  }

  async updateEnrollmentStatus(
    body: {
      userId: string;
      courseId: string;
      status: EnrollmentStatus;
      reason?: string;
    },
    req: any,
  ) {
    const enrollment = await this.enrollmentsService.updateEnrollmentStatus(
      body.userId,
      body.courseId,
      body.status,
      req.user.id,
      body.reason,
    );

    return { success: true, enrollment };
  }

  getUserEnrollments(userId: string, includeInactive?: string) {
    return this.enrollmentsService.getUserEnrollments(
      userId,
      includeInactive === 'true',
    );
  }

  getCourseEnrollments(courseId: string, includeInactive?: string) {
    return this.enrollmentsService.getCourseEnrollments(
      courseId,
      includeInactive === 'true',
    );
  }

  getCourseStats(courseId: string) {
    return this.enrollmentsService.getEnrollmentStats(courseId);
  }

  async deleteEnrollment(body: { userId: string; courseId: string }) {
    await this.enrollmentsService.deleteEnrollment(body.userId, body.courseId);
    return { success: true };
  }
}
