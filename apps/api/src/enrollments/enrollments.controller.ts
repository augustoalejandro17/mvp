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
import { EnrollmentsFacade } from './services/enrollments.facade';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnrollmentStatus } from './schemas/enrollment.schema';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(private readonly enrollmentsFacade: EnrollmentsFacade) {}

  @Post()
  async enrollUser(
    @Body() body: { userId: string; courseId: string },
    @Request() req: any,
  ) {
    return this.enrollmentsFacade.enrollUser(body, req);
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
    return this.enrollmentsFacade.updateEnrollmentStatus(body, req);
  }

  @Get('user/:userId')
  async getUserEnrollments(
    @Param('userId') userId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.enrollmentsFacade.getUserEnrollments(
      userId,
      includeInactive,
    );
  }

  @Get('course/:courseId')
  async getCourseEnrollments(
    @Param('courseId') courseId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.enrollmentsFacade.getCourseEnrollments(
      courseId,
      includeInactive,
    );
  }

  @Get('course/:courseId/stats')
  async getCourseStats(@Param('courseId') courseId: string) {
    return this.enrollmentsFacade.getCourseStats(courseId);
  }

  @Delete()
  async deleteEnrollment(@Body() body: { userId: string; courseId: string }) {
    return this.enrollmentsFacade.deleteEnrollment(body);
  }
}
