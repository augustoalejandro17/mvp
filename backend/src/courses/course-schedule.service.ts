import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CourseSchedule, CourseScheduleDocument, DayOfWeek } from './schemas/course-schedule.schema';
import { Course, CourseDocument } from './schemas/course.schema';
import { CreateCourseScheduleDto, UpdateCourseScheduleDto } from './dto/course-schedule.dto';

@Injectable()
export class CourseScheduleService {
  private readonly logger = new Logger(CourseScheduleService.name);

  constructor(
    @InjectModel(CourseSchedule.name) private courseScheduleModel: Model<CourseScheduleDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
  ) {}

  async createSchedule(courseId: string, createScheduleDto: CreateCourseScheduleDto): Promise<CourseSchedule> {
    this.logger.debug(`Creating schedule for course ${courseId}`);
    
    // Validate schedule times don't overlap
    if (createScheduleDto.scheduleTimes && createScheduleDto.scheduleTimes.length > 1) {
      this.validateScheduleTimes(createScheduleDto.scheduleTimes);
    }

    const schedule = new this.courseScheduleModel({
      ...createScheduleDto,
      course: courseId,
    });

    return schedule.save();
  }

  async updateSchedule(courseId: string, updateScheduleDto: UpdateCourseScheduleDto): Promise<CourseSchedule> {
    // Validate schedule times don't overlap if provided
    if (updateScheduleDto.scheduleTimes && updateScheduleDto.scheduleTimes.length > 1) {
      this.validateScheduleTimes(updateScheduleDto.scheduleTimes);
    }

    const schedule = await this.courseScheduleModel.findOneAndUpdate(
      { course: courseId },
      updateScheduleDto,
      { new: true, upsert: true }
    );

    return schedule;
  }

  async getSchedule(courseId: string): Promise<CourseSchedule | null> {
    return this.courseScheduleModel.findOne({ course: courseId });
  }

  async deleteSchedule(courseId: string): Promise<boolean> {
    const result = await this.courseScheduleModel.deleteOne({ course: courseId });
    return result.deletedCount > 0;
  }

  async getUpcomingClasses(timeWindow: { start: Date; end: Date }): Promise<any[]> {
    // Get all active schedules with notifications enabled
    const schedules = await this.courseScheduleModel.find({
      enableNotifications: true,
      'scheduleTimes.isActive': true
    }).populate({
      path: 'course',
      populate: {
        path: 'school teachers',
        select: 'name email timezone teachers'
      }
    });

    const upcomingClasses = [];

    for (const schedule of schedules) {
      if (!schedule.course || !(schedule.course as any).school) {
        this.logger.warn(`Schedule ${schedule._id} missing course or school data`);
        continue;
      }

      const course = schedule.course as any;
      const school = course.school;
      const schoolTimezone = school.timezone || 'America/Bogota';

      for (const scheduleTime of schedule.scheduleTimes) {
        if (!scheduleTime.isActive) continue;

        const nextClassTime = this.calculateNextClassTime(scheduleTime, schoolTimezone);

        if (nextClassTime >= timeWindow.start && nextClassTime <= timeWindow.end) {
          upcomingClasses.push({
            courseId: course._id,
            courseName: course.name,
            teachers: course.teachers || [],
            scheduleTime,
            classTime: nextClassTime,
            notificationMinutes: schedule.notificationMinutes || 10,
            schoolTimezone
          });
        }
      }
    }

    return upcomingClasses;
  }

  private calculateNextClassTime(scheduleTime: any, schoolTimezone: string): Date {
    const now = new Date();
    const timezoneOffset = this.getTimezoneOffset(schoolTimezone);
    
    // Convert current UTC time to school timezone
    const nowInSchoolTz = new Date(now.getTime() - timezoneOffset * 60000);
    
    // Parse the schedule time (e.g., "14:50")
    const [hours, minutes] = scheduleTime.startTime.split(':').map(Number);
    
    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const targetDay = this.getDayNumber(scheduleTime.dayOfWeek);
    const currentDay = nowInSchoolTz.getUTCDay();
    
    // Calculate days until next occurrence
    let daysUntilClass = targetDay - currentDay;
    if (daysUntilClass < 0) {
      daysUntilClass += 7; // Next week
    } else if (daysUntilClass === 0) {
      // Same day - check if time has passed
      const currentHour = nowInSchoolTz.getUTCHours();
      const currentMinute = nowInSchoolTz.getUTCMinutes();
      
      if (hours < currentHour || (hours === currentHour && minutes <= currentMinute)) {
        daysUntilClass = 7; // Next week
      }
    }
    
    // Create the class date in school timezone
    const classDateInSchoolTz = new Date(nowInSchoolTz);
    classDateInSchoolTz.setUTCDate(classDateInSchoolTz.getUTCDate() + daysUntilClass);
    classDateInSchoolTz.setUTCHours(hours, minutes, 0, 0);
    
    // Convert back to UTC
    const classDateUTC = new Date(classDateInSchoolTz.getTime() + timezoneOffset * 60000);
    
    return classDateUTC;
  }

  private getDayNumber(dayName: string): number {
    const days = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };
    return days[dayName.toLowerCase()] ?? 0;
  }

  private validateScheduleTimes(scheduleTimes: any[]): void {
    for (let i = 0; i < scheduleTimes.length; i++) {
      for (let j = i + 1; j < scheduleTimes.length; j++) {
        const time1 = scheduleTimes[i];
        const time2 = scheduleTimes[j];
        
        // Check if same day
        if (time1.dayOfWeek === time2.dayOfWeek && time1.isActive && time2.isActive) {
          const start1 = this.timeToMinutes(time1.startTime);
          const end1 = this.timeToMinutes(time1.endTime);
          const start2 = this.timeToMinutes(time2.startTime);
          const end2 = this.timeToMinutes(time2.endTime);
          
          // Check for overlap
          if (start1 < end2 && start2 < end1) {
            throw new Error(`Schedule times overlap: ${time1.dayOfWeek} ${time1.startTime}-${time1.endTime} and ${time2.startTime}-${time2.endTime}`);
          }
        }
      }
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Use the same timezone offset method as attendance service
  private getTimezoneOffset(timezone: string): number {
    switch (timezone) {
      case 'America/Bogota':
        return 5 * 60; // GMT-5
      case 'America/New_York':
        return 5 * 60; // GMT-5 (EST)
      case 'America/Los_Angeles':
        return 8 * 60; // GMT-8 (PST)
      case 'UTC':
        return 0;
      case 'Europe/Madrid':
        return -1 * 60; // GMT+1
      default:
        return 5 * 60; // Default to GMT-5 (Bogota)
    }
  }
} 