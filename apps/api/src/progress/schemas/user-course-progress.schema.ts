import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { Course } from '../../courses/schemas/course.schema';

export type UserCourseProgressDocument = UserCourseProgress & Document;

@Schema({ timestamps: true })
export class UserCourseProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  course: Course;

  @Prop({ type: Types.ObjectId, ref: 'School', required: true })
  school: Types.ObjectId;

  @Prop({ default: 0 })
  totalClasses: number;

  @Prop({ default: 0 })
  completedClasses: number;

  @Prop({ default: 0, min: 0, max: 100 })
  completionPercentage: number;

  @Prop({ default: 0 })
  totalVideoMinutes: number;

  @Prop({ default: 0 })
  watchedVideoMinutes: number;

  @Prop({ default: 0 })
  attendedClasses: number;

  @Prop({ default: 0 })
  totalAttendanceRecords: number;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop()
  completedAt?: Date;

  @Prop({ default: Date.now })
  enrolledAt: Date;

  @Prop({ default: Date.now })
  lastActivityAt: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  // Performance metrics
  @Prop({ default: 0 })
  averageVideoWatchPercentage: number;

  @Prop({ default: 0 })
  totalPointsEarned: number;

  @Prop({ default: 0 })
  streak: number; // Current streak of consecutive class completions

  @Prop({ default: 0 })
  longestStreak: number;
}

export const UserCourseProgressSchema =
  SchemaFactory.createForClass(UserCourseProgress);

// Create compound index for efficient queries
UserCourseProgressSchema.index({ user: 1, course: 1 }, { unique: true });
UserCourseProgressSchema.index({ user: 1, school: 1 });
UserCourseProgressSchema.index({ course: 1, isCompleted: 1 });
UserCourseProgressSchema.index({ school: 1, completionPercentage: -1 });
