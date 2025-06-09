import { Injectable, Logger } from '@nestjs/common';
import { UsageTrackingService, StreamingTrackingOptions } from '../usage-tracking.service';
import { v4 as uuidv4 } from 'uuid';

interface ActiveSession {
  sessionId: string;
  schoolId: string;
  startTime: Date;
  userId: string;
  assetId: string;
}

@Injectable()
export class StreamingIntegrationService {
  private readonly logger = new Logger(StreamingIntegrationService.name);
  private activeSessions = new Map<string, ActiveSession>(); // sessionId -> session data

  constructor(private readonly usageTrackingService: UsageTrackingService) {}

  /**
   * Start tracking when user begins streaming a video
   * Call this when video playback starts (e.g., in VideoPlayer component)
   */
  async startVideoStreaming(
    userId: string,
    assetId: string, // S3 key or video identifier
    schoolId: string,
    relatedCourse?: string,
    relatedClass?: string,
    quality: 'low' | 'medium' | 'high' = 'medium',
    deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop'
  ): Promise<string> {
    try {
      const sessionId = uuidv4();
      const startTime = new Date();

      // Store active session for cleanup tracking
      this.activeSessions.set(sessionId, {
        sessionId,
        schoolId,
        startTime,
        userId,
        assetId
      });

      const trackingOptions: StreamingTrackingOptions = {
        sessionId,
        userId,
        assetId,
        schoolId,
        relatedCourse,
        relatedClass,
        quality,
        deviceType
      };

      await this.usageTrackingService.startStreamingSession(trackingOptions);
      
      this.logger.log(`Streaming session started: ${sessionId} for user ${userId}, asset ${assetId}`);
      return sessionId;
    } catch (error) {
      this.logger.error(`Error starting streaming session: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * End tracking when user stops streaming
   * Call this when video playback ends, pauses for extended time, or user navigates away
   */
  async endVideoStreaming(
    sessionId: string,
    bytesTransferred?: number
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.logger.warn(`Attempted to end unknown streaming session: ${sessionId}`);
        return;
      }

      await this.usageTrackingService.endStreamingSession(
        session.schoolId,
        sessionId,
        bytesTransferred
      );

      // Remove from active sessions
      this.activeSessions.delete(sessionId);
      
      this.logger.log(`Streaming session ended: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error ending streaming session: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update bandwidth usage during streaming
   * Call this periodically during video playback to track bandwidth
   */
  async updateStreamingBandwidth(
    sessionId: string,
    additionalBytes: number
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        this.logger.warn(`Attempted to update bandwidth for unknown session: ${sessionId}`);
        return;
      }

      // For now, we'll just log this. In a full implementation, you might want to
      // track incremental bandwidth usage or buffer it until session end
      this.logger.debug(`Bandwidth update: ${sessionId} +${additionalBytes} bytes`);
    } catch (error) {
      this.logger.error(`Error updating streaming bandwidth: ${error.message}`, error.stack);
    }
  }

  /**
   * Cleanup sessions that have been active too long (auto-timeout)
   * Call this periodically via cron job
   */
  async cleanupStaleSessions(maxAgeMinutes: number = 120): Promise<void> {
    try {
      const now = new Date();
      const staleSessionIds: string[] = [];

      for (const [sessionId, session] of this.activeSessions.entries()) {
        const ageMinutes = (now.getTime() - session.startTime.getTime()) / 60000;
        if (ageMinutes > maxAgeMinutes) {
          staleSessionIds.push(sessionId);
        }
      }

      for (const sessionId of staleSessionIds) {
        this.logger.warn(`Auto-ending stale streaming session: ${sessionId}`);
        await this.endVideoStreaming(sessionId);
      }

      if (staleSessionIds.length > 0) {
        this.logger.log(`Cleaned up ${staleSessionIds.length} stale streaming sessions`);
      }
    } catch (error) {
      this.logger.error(`Error cleaning up stale sessions: ${error.message}`, error.stack);
    }
  }

  /**
   * Get active sessions count (for monitoring)
   */
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get active sessions for a specific school (for monitoring)
   */
  getActiveSessionsForSchool(schoolId: string): ActiveSession[] {
    return Array.from(this.activeSessions.values()).filter(
      session => session.schoolId === schoolId
    );
  }

  /**
   * Force end all sessions for a user (e.g., when user logs out)
   */
  async endAllSessionsForUser(userId: string): Promise<void> {
    try {
      const userSessions = Array.from(this.activeSessions.values()).filter(
        session => session.userId === userId
      );

      for (const session of userSessions) {
        await this.endVideoStreaming(session.sessionId);
      }

      if (userSessions.length > 0) {
        this.logger.log(`Ended ${userSessions.length} sessions for user logout: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error ending user sessions: ${error.message}`, error.stack);
    }
  }

  /**
   * Helper to determine school from context for streaming
   */
  async determineSchoolForStreaming(
    userId: string,
    assetId: string,
    relatedCourse?: string,
    relatedClass?: string,
    explicitSchoolId?: string
  ): Promise<string> {
    if (explicitSchoolId) {
      return explicitSchoolId;
    }

    // Priority logic:
    // 1. If relatedClass provided, get school from class -> course -> school
    // 2. If relatedCourse provided, get school from course
    // 3. If assetId can be traced to a class/course, use that school
    // 4. Use user's primary/first school

    // For now, throw error to force explicit school attribution
    throw new Error('School attribution required for streaming tracking. Please provide explicit schoolId.');
  }
} 