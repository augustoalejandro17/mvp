import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { Badge } from './badge.schema';
import { Course } from '../../courses/schemas/course.schema';
import { School } from '../../schools/schemas/school.schema';

export type UserAchievementDocument = UserAchievement & Document;

export enum AchievementStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

export interface ProgressData {
  current: number;
  required: number;
  percentage: number;
  lastUpdated: Date;
}

@Schema({ timestamps: true })
export class UserAchievement {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Badge', required: true })
  badge: Badge;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'School', required: false })
  school?: School;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: false })
  course?: Course;

  @Prop({ type: String, enum: AchievementStatus, default: AchievementStatus.IN_PROGRESS })
  status: AchievementStatus;

  @Prop({ type: Object, required: true })
  progress: ProgressData;

  @Prop({ required: false })
  completedAt?: Date;

  @Prop({ required: false })
  expiresAt?: Date;

  @Prop({ default: 0 })
  pointsEarned: number;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false })
  isNotified: boolean; // Whether user has been notified about completion

  @Prop({ type: [String], default: [] })
  evidenceUrls: string[]; // Screenshots, videos, etc.

  @Prop({ required: false })
  teacherComment?: string;

  @Prop({ required: false })
  teacherApprovedAt?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  teacherApprovedBy?: User;
}

export const UserAchievementSchema = SchemaFactory.createForClass(UserAchievement);

// Compound index for efficient queries
UserAchievementSchema.index({ user: 1, badge: 1, school: 1 });
UserAchievementSchema.index({ user: 1, status: 1 });
UserAchievementSchema.index({ school: 1, status: 1 });
UserAchievementSchema.index({ course: 1, status: 1 }); 