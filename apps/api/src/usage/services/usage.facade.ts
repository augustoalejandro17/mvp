import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  UsageTrackingService,
  UsageSummary,
} from '../usage-tracking.service';
import { StreamingIntegrationService } from '../integration/streaming-integration.service';

@Injectable()
export class UsageFacade {
  private readonly logger = new Logger(UsageFacade.name);

  constructor(
    private readonly usageTrackingService: UsageTrackingService,
    private readonly streamingIntegrationService: StreamingIntegrationService,
  ) {}

  private parseOptionalIntInRange(
    value: string | undefined,
    fieldName: string,
    min: number,
    max: number,
  ): number | undefined {
    if (value === undefined) return undefined;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(
        `${fieldName} debe ser un entero entre ${min} y ${max}`,
      );
    }

    return parsed;
  }

  async getSchoolUsageSummary(
    schoolId: string,
    month?: string,
    year?: string,
  ): Promise<UsageSummary> {
    try {
      const monthNum = this.parseOptionalIntInRange(month, 'month', 1, 12);
      const yearNum = this.parseOptionalIntInRange(year, 'year', 2020, 2100);

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

  async getSchoolsWithOverages(month?: string, year?: string): Promise<any[]> {
    try {
      const monthNum = this.parseOptionalIntInRange(month, 'month', 1, 12);
      const yearNum = this.parseOptionalIntInRange(year, 'year', 2020, 2100);

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

  async startStreamingSession(
    userId: string,
    body: {
      assetId: string;
      schoolId: string;
      relatedCourse?: string;
      relatedClass?: string;
      quality?: 'low' | 'medium' | 'high';
      deviceType?: 'mobile' | 'desktop' | 'tablet';
    },
  ): Promise<{ sessionId: string }> {
    try {
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

  async endStreamingSession(
    sessionId: string,
    bytesTransferred?: number,
  ): Promise<{ success: boolean }> {
    try {
      await this.streamingIntegrationService.endVideoStreaming(
        sessionId,
        bytesTransferred,
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

  async endStreamingSessionWithCompletion(
    sessionId: string,
    body: {
      watchedPercentage: number;
      videoDuration: number;
      videoTitle: string;
      bytesTransferred?: number;
    },
  ): Promise<{ success: boolean }> {
    try {
      await this.streamingIntegrationService.endVideoStreamingWithCompletion(
        sessionId,
        body,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error ending streaming session with completion: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async trackVideoCompletionStreak(
    userId: string,
    body: {
      schoolId: string;
      courseId: string;
      classId: string;
      consecutiveVideosCompleted: number;
    },
  ): Promise<{ success: boolean }> {
    try {
      await this.streamingIntegrationService.trackVideoCompletionStreak(
        userId,
        body.schoolId,
        body.courseId,
        body.classId,
        body.consecutiveVideosCompleted,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error tracking video completion streak: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async endAllUserSessions(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
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

  async getActiveStreamingSessions(schoolId: string): Promise<any[]> {
    try {
      return this.streamingIntegrationService.getActiveSessionsForSchool(
        schoolId,
      );
    } catch (error) {
      this.logger.error(
        `Error getting active streaming sessions for school ${schoolId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getStreamingHistory(
    schoolId: string,
    startDate?: string,
    endDate?: string,
    limit?: string,
  ): Promise<any[]> {
    try {
      const limitNum =
        this.parseOptionalIntInRange(limit, 'limit', 1, 200) ?? 50;

      return await this.usageTrackingService.getStreamingHistory(
        schoolId,
        startDate,
        endDate,
        limitNum,
      );
    } catch (error) {
      this.logger.error(
        `Error getting streaming history for school ${schoolId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async finalizeMonthlyUsage(body: {
    month: number;
    year: number;
  }): Promise<{ success: boolean; message: string }> {
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

  async cleanupStaleSessions(body: {
    maxAgeMinutes?: number;
  }): Promise<{ success: boolean; message: string }> {
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

  async getActiveSessionsStats(): Promise<{
    totalActiveSessions: number;
    sessionsBySchool: { schoolId: string; count: number }[];
  }> {
    try {
      return {
        totalActiveSessions:
          this.streamingIntegrationService.getActiveSessionsCount(),
        sessionsBySchool: [],
      };
    } catch (error) {
      this.logger.error(
        `Error getting active sessions stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async fixStorageTotal(body: { schoolId: string; totalMB: number }) {
    try {
      const { schoolId, totalMB } = body;
      const totalBytes = totalMB * 1024 * 1024;
      const totalGB = totalMB / 1024;

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
      throw new InternalServerErrorException(
        `Error fixing storage total: ${error.message}`,
      );
    }
  }
}
