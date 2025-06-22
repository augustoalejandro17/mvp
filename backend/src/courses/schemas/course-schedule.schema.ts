import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Course } from './course.schema';

export type CourseScheduleDocument = CourseSchedule & Document;

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

@Schema()
export class ScheduleTime {
  @Prop({ type: String, enum: DayOfWeek, required: true })
  dayOfWeek: DayOfWeek;

  @Prop({ required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ })
  startTime: string; // Format: "HH:MM" (24-hour format)

  @Prop({ required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ })
  endTime: string; // Format: "HH:MM" (24-hour format)

  @Prop({ default: true })
  isActive: boolean;
}

export const ScheduleTimeSchema = SchemaFactory.createForClass(ScheduleTime);

@Schema({ timestamps: true })
export class CourseSchedule {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: true, unique: true })
  course: Course;

  @Prop({ type: [ScheduleTimeSchema], default: [] })
  scheduleTimes: ScheduleTime[];

  @Prop({ default: true })
  enableNotifications: boolean;

  @Prop({ default: 10 })
  notificationMinutes: number; // Minutes before class to send notification

  @Prop({ default: true })
  isActive: boolean;
}

export const CourseScheduleSchema = SchemaFactory.createForClass(CourseSchedule); 