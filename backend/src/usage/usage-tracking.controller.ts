import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { UsageTrackingService, UsageSummary } from './usage-tracking.service';
import { StreamingIntegrationService } from './integration/streaming-integration.service';
@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageTrackingController {
  private readonly logger = new Logger(UsageTrackingController.name);

  constructor(
    private readonly usageTrackingService: UsageTrackingService,
    private readonly streamingIntegrationService: StreamingIntegrationService,
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
    try {
      const monthNum = month ? parseInt(month) : undefined;
      const yearNum = year ? parseInt(year) : undefined;

      return await this.usageTrackingService.getUsageSummary(
        schoolId,
        monthNum,
        yearNum,
      );
    } catch (error) {
      this.logger.error(
        `Error getting usage summary for school ${schoolId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    try {
      const monthNum = month ? parseInt(month) : undefined;
      const yearNum = year ? parseInt(year) : undefined;

      return await this.usageTrackingService.getSchoolsWithOverages(
        monthNum,
        yearNum,
      );
    } catch (error) {
      this.logger.error(
        `Error getting schools with overages: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    try {
      const userId = req.user.sub || req.user._id;

      const sessionId =
        await this.streamingIntegrationService.startVideoStreaming(
          userId,
          body.assetId,
          body.schoolId,
          body.relatedCourse,
          body.relatedClass,
          body.quality,
          body.deviceType,
        );

      return { sessionId };
    } catch (error) {
      this.logger.error(
        `Error starting streaming session: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('streaming/end/:sessionId')
  async endStreamingSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { bytesTransferred?: number },
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    try {
      await this.streamingIntegrationService.endVideoStreaming(
        sessionId,
        body.bytesTransferred,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error ending streaming session: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('streaming/end-user-sessions')
  async endAllUserSessions(
    @Req() req: any,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userId = req.user.sub || req.user._id;

      await this.streamingIntegrationService.endAllSessionsForUser(userId);

      return {
        success: true,
        message: 'All streaming sessions ended for user',
      };
    } catch (error) {
      this.logger.error(
        `Error ending user sessions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    try {
      return [];
    } catch (error) {
      this.logger.error(
        `Error getting active streaming sessions for school ${schoolId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    try {
      return await this.usageTrackingService.getStreamingHistory(
        schoolId,
        startDate,
        endDate,
        parseInt(limit || '50'),
      );
    } catch (error) {
      this.logger.error(
        `Error getting streaming history for school ${schoolId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    try {
      await this.usageTrackingService.finalizeMonthlyUsage(
        body.month,
        body.year,
      );

      return {
        success: true,
        message: `Monthly usage finalized for ${body.month}/${body.year}`,
      };
    } catch (error) {
      this.logger.error(
        `Error finalizing monthly usage: ${error.message}`,
        error.stack,
      );
      throw error;
    }
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
    try {
      const result =
        await this.usageTrackingService.backfillStorageUsageWithRealSizes();

      return {
        success: true,
        processed: result.processed,
        errors: result.errors,
        message: `Backfill completed with REAL file sizes. Processed: ${result.processed}, Errors: ${result.errors}`,
      };
    } catch (error) {
      this.logger.error(
        `Error during storage backfill: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('admin/reset-storage-tracking')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async resetStorageTracking(): Promise<{
    success: boolean;
    processed: number;
    message: string;
  }> {
    try {
      const result = await this.usageTrackingService.resetStorageTracking();

      return {
        success: true,
        processed: result.processed,
        message: `Storage tracking reset. Processed: ${result.processed} videos with corrected sizes`,
      };
    } catch (error) {
      this.logger.error(
        `Error resetting storage tracking: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('admin/cleanup-stale-sessions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async cleanupStaleSessions(
    @Body() body: { maxAgeMinutes?: number },
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.streamingIntegrationService.cleanupStaleSessions(
        body.maxAgeMinutes,
      );

      return {
        success: true,
        message: 'Stale streaming sessions cleaned up',
      };
    } catch (error) {
      this.logger.error(
        `Error cleaning up stale sessions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('admin/active-sessions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getActiveSessionsStats(): Promise<{
    totalActiveSessions: number;
    sessionsBySchool: { schoolId: string; count: number }[];
  }> {
    try {
      const totalActiveSessions =
        this.streamingIntegrationService.getActiveSessionsCount();

      // You could enhance this to group by school
      const sessionsBySchool: { schoolId: string; count: number }[] = [];

      return {
        totalActiveSessions,
        sessionsBySchool,
      };
    } catch (error) {
      this.logger.error(
        `Error getting active sessions stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('admin/fix-storage-total')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async fixStorageTotal(@Body() body: { schoolId: string; totalMB: number }) {
    try {
      const { schoolId, totalMB } = body;
      const totalBytes = totalMB * 1024 * 1024; // Convert MB to bytes
      const totalGB = totalMB / 1024; // Convert MB to GB

      // Update all usage documents for this school to have the correct total
      await this.usageTrackingService.fixStorageTotal(
        schoolId,
        totalBytes,
        totalGB,
      );

      return {
        success: true,
        message: `Storage total updated to ${totalMB} MB (${totalGB.toFixed(3)} GB) for school ${schoolId}`,
      };
    } catch (error) {
      throw new Error(`Error fixing storage total: ${error.message}`);
    }
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
