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
      this.logger.debug('🔔 Running notification check...');
      
      const now = new Date();
      
      // Look for classes that need notifications in the next 30 minutes
      // We'll filter by each course's specific notification timing later
      const windowStart = new Date(now.getTime() + 4 * 60000);  // 4 minutes from now
      const windowEnd = new Date(now.getTime() + 31 * 60000);   // 31 minutes from now
      
      this.logger.debug(`⏰ Looking for classes between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`);
      
      const upcomingClasses = await this.courseScheduleService.getUpcomingClasses({
        start: windowStart,
        end: windowEnd
      });
      
      this.logger.debug(`📚 Found ${upcomingClasses.length} upcoming classes to check`);
      
      if (upcomingClasses.length > 0) {
        await this.sendClassReminders(upcomingClasses, now);
      }
      
    } catch (error) {
      this.logger.error('❌ Error in notification scheduler:', error);
    }
  }

  private async sendClassReminders(upcomingClasses: any[], currentTime: Date) {
    this.logger.debug(`📨 Processing ${upcomingClasses.length} potential classes for reminders`);
    
    for (const classInfo of upcomingClasses) {
      try {
        const { courseId, courseName, teachers, classTime, notificationMinutes } = classInfo;
        
        // Calculate when the notification should be sent for this specific class
        const classStartTime = new Date(classTime);
        const notificationTime = new Date(classStartTime.getTime() - (notificationMinutes * 60000));
        
        // Check if it's time to send this notification (within 1 minute window)
        const timeDifference = Math.abs(currentTime.getTime() - notificationTime.getTime());
        const isTimeToNotify = timeDifference <= 60000; // Within 1 minute
        
        this.logger.debug(`📧 Course: ${courseName}`);
        this.logger.debug(`⏰ Class time: ${classStartTime.toLocaleString('en-US', { timeZone: 'America/Bogota' })}`);
        this.logger.debug(`📅 Notification should be sent at: ${notificationTime.toLocaleString('en-US', { timeZone: 'America/Bogota' })}`);
        this.logger.debug(`🕐 Current time: ${currentTime.toLocaleString('en-US', { timeZone: 'America/Bogota' })}`);
        this.logger.debug(`⏱️ Time difference: ${Math.round(timeDifference / 1000)} seconds`);
        this.logger.debug(`✅ Should notify now: ${isTimeToNotify}`);
        
        if (!isTimeToNotify) {
          this.logger.debug(`⏭️ Skipping ${courseName} - not time yet`);
          continue;
        }
        
        this.logger.debug(`📤 Sending notifications for ${courseName}`);
        this.logger.debug(`👥 Teachers: ${teachers.length}`);
        this.logger.debug(`⏰ Notification time: ${notificationMinutes} minutes before class`);
        
        // Send notification to each teacher
        for (const teacher of teachers) {
          const teacherId = (teacher as any)._id || teacher;
          
          this.logger.debug(`📤 Sending notification to teacher: ${teacherId}`);
          
          await this.notificationsService.createClassReminder(
            teacherId.toString(),
            courseId.toString(),
            classTime,
            notificationMinutes
          );
          
          this.logger.debug(`✅ Notification sent to teacher ${teacherId} (${notificationMinutes} min reminder)`);
        }
        
      } catch (error) {
        this.logger.error(`❌ Error sending reminder for class ${classInfo.courseName}:`, error);
      }
    }
  }

  // Daily cleanup at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldNotifications() {
    try {
      this.logger.debug('🧹 Running daily notification cleanup...');
      await this.notificationsService.cleanupOldNotifications();
      this.logger.debug('✅ Notification cleanup completed');
    } catch (error) {
      this.logger.error('❌ Error in notification cleanup:', error);
    }
  }

  // Manual testing methods
  async testNotificationCheck() {
    this.logger.debug('🧪 Manual test: Checking for upcoming classes...');
    await this.checkForUpcomingClasses();
  }

  async getUpcomingClassesForTesting() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 4 * 60000);
    const windowEnd = new Date(now.getTime() + 6 * 60000);
    
    return await this.courseScheduleService.getUpcomingClasses({
      start: windowStart,
      end: windowEnd
    });
  }
} 