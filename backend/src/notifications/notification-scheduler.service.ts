import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { CourseScheduleService } from '../courses/course-schedule.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly courseScheduleService: CourseScheduleService,
  ) {}

  @Cron('* * * * *') // Run every minute
  async checkForUpcomingClasses() {
    try {
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
    } catch (error) {
      this.logger.error('Error in notification scheduler:', error);
    }
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
          error,
        );
      }
    }
  }

  // Daily cleanup at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldNotifications() {
    try {
      await this.notificationsService.cleanupOldNotifications();
    } catch (error) {
      this.logger.error('Error in notification cleanup:', error);
    }
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
