import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnrollmentStatus } from './schemas/enrollment.schema';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  async enrollUser(
    @Body() body: { userId: string; courseId: string },
    @Request() req: any,
  ) {
    const { userId, courseId } = body;
    const enrolledBy = req.user.id;

    const enrollment = await this.enrollmentsService.enrollUser(
      userId,
      courseId,
      enrolledBy,
    );
    return { success: true, enrollment };
  }

  @Patch('status')
  async updateEnrollmentStatus(
    @Body()
    body: {
      userId: string;
      courseId: string;
      status: EnrollmentStatus;
      reason?: string;
    },
    @Request() req: any,
  ) {
    const { userId, courseId, status, reason } = body;
    const changedBy = req.user.id;

    const enrollment = await this.enrollmentsService.updateEnrollmentStatus(
      userId,
      courseId,
      status,
      changedBy,
      reason,
    );

    return { success: true, enrollment };
  }

  @Get('user/:userId')
  async getUserEnrollments(
    @Param('userId') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const includeInactiveBoolean = includeInactive === 'true';
    const enrollments = await this.enrollmentsService.getUserEnrollments(
      userId,
      includeInactiveBoolean,
    );
    return enrollments;
  }

  @Get('course/:courseId')
  async getCourseEnrollments(
    @Param('courseId') courseId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const includeInactiveBoolean = includeInactive === 'true';
    const enrollments = await this.enrollmentsService.getCourseEnrollments(
      courseId,
      includeInactiveBoolean,
    );
    return enrollments;
  }

  @Get('course/:courseId/stats')
  async getCourseStats(@Param('courseId') courseId: string) {
    const stats = await this.enrollmentsService.getEnrollmentStats(courseId);
    return stats;
  }

  @Delete()
  async deleteEnrollment(@Body() body: { userId: string; courseId: string }) {
    const { userId, courseId } = body;
    await this.enrollmentsService.deleteEnrollment(userId, courseId);
    return { success: true };
  }
}
