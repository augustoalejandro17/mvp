import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { UsageSummary } from './usage-tracking.service';
import { UsageFacade } from './services/usage.facade';
@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageTrackingController {
  constructor(
    private readonly usageFacade: UsageFacade,
  ) {}

  // ========================================
  // USAGE SUMMARY ENDPOINTS
  // ========================================

  @Get('school/:schoolId/summary')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async getSchoolUsageSummary(
    @Param('schoolId') schoolId: string,
    @Query('month') month: string | undefined,
    @Query('year') year: string | undefined,
    @Req() req: any,
  ): Promise<UsageSummary> {
    return this.usageFacade.getSchoolUsageSummary(
      schoolId,
      month,
      year,
    );
  }

  @Get('schools/overages')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async getSchoolsWithOverages(
    @Query('month') month: string | undefined,
    @Query('year') year: string | undefined,
  ): Promise<any[]> {
    return this.usageFacade.getSchoolsWithOverages(month, year);
  }

  // ========================================
  // STREAMING SESSION ENDPOINTS
  // ========================================

  @Post('streaming/start')
  async startStreamingSession(
    @Body()
    body: {
      assetId: string;
      schoolId: string;
      relatedCourse?: string;
      relatedClass?: string;
      quality?: 'low' | 'medium' | 'high';
      deviceType?: 'mobile' | 'desktop' | 'tablet';
    },
    @Req() req: any,
  ): Promise<{ sessionId: string }> {
    const userId = req.user.sub || req.user._id;
    return this.usageFacade.startStreamingSession(userId, body);
  }

  @Post('streaming/end/:sessionId')
  async endStreamingSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { bytesTransferred?: number },
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    return this.usageFacade.endStreamingSession(
      sessionId,
      body.bytesTransferred,
    );
  }

  @Post('streaming/end/:sessionId/completion')
  async endStreamingSessionWithCompletion(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      watchedPercentage: number;
      videoDuration: number;
      videoTitle: string;
      bytesTransferred?: number;
    },
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    return this.usageFacade.endStreamingSessionWithCompletion(
      sessionId,
      body,
    );
  }

  @Post('streaming/track-video-streak')
  async trackVideoCompletionStreak(
    @Body()
    body: {
      schoolId: string;
      courseId: string;
      classId: string;
      consecutiveVideosCompleted: number;
    },
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    const userId = req.user.sub || req.user._id;
    return this.usageFacade.trackVideoCompletionStreak(userId, body);
  }

  @Post('streaming/end-user-sessions')
  async endAllUserSessions(
    @Req() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.sub || req.user._id;
    return this.usageFacade.endAllUserSessions(userId);
  }

  @Get('streaming/active/:schoolId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async getActiveStreamingSessions(
    @Param('schoolId') schoolId: string,
    @Req() req: any,
  ): Promise<any[]> {
    return this.usageFacade.getActiveStreamingSessions(schoolId);
  }

  @Get('streaming/history/:schoolId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async getStreamingHistory(
    @Param('schoolId') schoolId: string,
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    return this.usageFacade.getStreamingHistory(
      schoolId,
      startDate,
      endDate,
      limit,
    );
  }

  // ========================================
  // ADMIN ENDPOINTS
  // ========================================

  @Post('admin/finalize-month')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async finalizeMonthlyUsage(
    @Body() body: { month: number; year: number },
  ): Promise<{ success: boolean; message: string }> {
    return this.usageFacade.finalizeMonthlyUsage(body);
  }

  @Post('admin/backfill-storage')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async backfillStorageUsage(): Promise<{
    success: boolean;
    processed: number;
    errors: number;
    message: string;
  }> {
    return this.usageFacade.backfillStorageUsage();
  }

  @Post('admin/reset-storage-tracking')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async resetStorageTracking(): Promise<{
    success: boolean;
    processed: number;
    message: string;
  }> {
    return this.usageFacade.resetStorageTracking();
  }

  @Post('admin/cleanup-stale-sessions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async cleanupStaleSessions(
    @Body() body: { maxAgeMinutes?: number },
  ): Promise<{ success: boolean; message: string }> {
    return this.usageFacade.cleanupStaleSessions(body);
  }

  @Get('admin/active-sessions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getActiveSessionsStats(): Promise<{
    totalActiveSessions: number;
    sessionsBySchool: { schoolId: string; count: number }[];
  }> {
    return this.usageFacade.getActiveSessionsStats();
  }

  @Post('admin/fix-storage-total')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async fixStorageTotal(@Body() body: { schoolId: string; totalMB: number }) {
    return this.usageFacade.fixStorageTotal(body);
  }

  // ========================================
  // HEALTH CHECK ENDPOINTS
  // ========================================

  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
