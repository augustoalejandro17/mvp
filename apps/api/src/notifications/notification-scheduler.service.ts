import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { CourseScheduleService } from '../courses/course-schedule.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5 seconds

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly courseScheduleService: CourseScheduleService,
  ) {}

  @Cron('* * * * *') // Run every minute
  async checkForUpcomingClasses() {
    await this.executeWithRetry(async () => {
      const now = new Date();

      // Look for classes that need notifications in the next 30 minutes
      // We'll filter by each course's specific notification timing later
      const windowStart = new Date(now.getTime() + 4 * 60000); // 4 minutes from now
      const windowEnd = new Date(now.getTime() + 31 * 60000); // 31 minutes from now

      const upcomingClasses =
        await this.courseScheduleService.getUpcomingClasses({
          start: windowStart,
          end: windowEnd,
        });

      if (upcomingClasses.length > 0) {
        await this.sendClassReminders(upcomingClasses, now);
      }
    }, 'notification scheduler');
  }

  private async sendClassReminders(upcomingClasses: any[], currentTime: Date) {
    for (const classInfo of upcomingClasses) {
      try {
        const {
          courseId,
          courseName,
          teachers,
          classTime,
          notificationMinutes,
        } = classInfo;

        // Calculate when the notification should be sent for this specific class
        const classStartTime = new Date(classTime);
        const notificationTime = new Date(
          classStartTime.getTime() - notificationMinutes * 60000,
        );

        // Check if it's time to send this notification (within 1 minute window)
        const timeDifference = Math.abs(
          currentTime.getTime() - notificationTime.getTime(),
        );
        const isTimeToNotify = timeDifference <= 60000; // Within 1 minute

        if (!isTimeToNotify) {
          continue;
        }

        // Send notification to each teacher
        for (const teacher of teachers) {
          const teacherId = (teacher as any)._id || teacher;

          await this.notificationsService.createClassReminder(
            teacherId.toString(),
            courseId.toString(),
            classTime,
            notificationMinutes,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error sending reminder for class ${classInfo.courseName}:`,
          error.message,
        );
      }
    }
  }

  // Daily cleanup at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldNotifications() {
    await this.executeWithRetry(async () => {
      await this.notificationsService.cleanupOldNotifications();
    }, 'notification cleanup');
  }

  /**
   * Execute operation with retry mechanism for MongoDB connection issues
   */
  private async executeWithRetry(
    operation: () => Promise<void>,
    operationName: string,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await operation();

        // If we had previous failures but this attempt succeeded, log recovery
        if (lastError && attempt > 1) {
          this.logger.log(
            `${operationName} recovered after ${attempt} attempts`,
          );
        }

        return; // Success
      } catch (error) {
        lastError = error;

        // Check if this is a MongoDB connection error
        const isConnectionError = this.isMongoConnectionError(error);

        if (isConnectionError && attempt < this.maxRetries) {
          this.logger.warn(
            `${operationName} failed (attempt ${attempt}/${this.maxRetries}): ${error.message}. Retrying in ${this.retryDelay}ms...`,
          );

          // Wait before retrying
          await this.sleep(this.retryDelay);
        } else {
          // Final attempt failed or non-connection error
          this.logger.error(
            `Error in ${operationName}${attempt > 1 ? ` after ${attempt} attempts` : ''}:`,
            error.message,
          );

          // Don't throw for connection errors to prevent crashing the scheduler
          if (!isConnectionError) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Check if error is related to MongoDB connection issues
   */
  private isMongoConnectionError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';

    return (
      errorName.includes('mongoserverselectionerror') ||
      errorName.includes('poolclearedonnetworkerror') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('server selection')
    );
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Manual testing methods
  async testNotificationCheck() {
    await this.checkForUpcomingClasses();
  }

  async getUpcomingClassesForTesting() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 4 * 60000);
    const windowEnd = new Date(now.getTime() + 6 * 60000);

    return await this.courseScheduleService.getUpcomingClasses({
      start: windowStart,
      end: windowEnd,
    });
  }
}
