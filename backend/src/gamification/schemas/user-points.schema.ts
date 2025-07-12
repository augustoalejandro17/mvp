import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { School } from '../../schools/schemas/school.schema';
import { Course } from '../../courses/schemas/course.schema';

export type UserPointsDocument = UserPoints & Document & { _id: any };

export enum PointsActionType {
  VIDEO_WATCH = 'video_watch',
  CLASS_ATTENDANCE = 'class_attendance',
  ASSIGNMENT_COMPLETION = 'assignment_completion',
  QUIZ_COMPLETION = 'quiz_completion',
  BADGE_EARNED = 'badge_earned',
  STREAK_BONUS = 'streak_bonus',
  TEACHER_REWARD = 'teacher_reward',
  PARTICIPATION = 'participation',
  HELP_OTHERS = 'help_others',
  EARLY_SUBMISSION = 'early_submission',
  PERFECT_SCORE = 'perfect_score',
  LEVEL_UP = 'level_up',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
}

export interface PointsTransaction {
  points: number;
  actionType: PointsActionType;
  description: string;
  date: Date;
  courseId?: string;
  classId?: string;
  badgeId?: string;
  metadata?: Record<string, any>;
}

export interface LevelInfo {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  benefits: string[];
  badgeUrl?: string;
}

@Schema({ timestamps: true })
export class UserPoints {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'School', required: true })
  school: School;

  @Prop({ default: 0 })
  totalPoints: number;

  @Prop({ default: 0 })
  availablePoints: number; // Points that can be spent

  @Prop({ default: 0 })
  spentPoints: number;

  @Prop({ default: 1 })
  level: number;

  @Prop({ type: Object, required: false })
  levelInfo: LevelInfo;

  @Prop({ default: 0 })
  pointsToNextLevel: number;

  @Prop({ type: [Object], default: [] })
  transactions: PointsTransaction[];

  @Prop({ type: Map, of: Number, default: {} })
  coursePoints: Map<string, number>; // Points per course

  @Prop({ type: Map, of: Number, default: {} })
  categoryPoints: Map<string, number>; // Points per category

  @Prop({ default: 0 })
  streak: number; // Current streak days

  @Prop({ default: 0 })
  longestStreak: number;

  @Prop({ required: false })
  lastActivityDate?: Date;

  @Prop({ default: 0 })
  rank: number; // Global rank

  @Prop({ default: 0 })
  schoolRank: number; // Rank within school

  @Prop({ type: Object, default: {} })
  monthlyStats: Record<string, { points: number; activities: number }>;

  @Prop({ type: Object, default: {} })
  weeklyStats: Record<string, { points: number; activities: number }>;

  @Prop({ type: Object, default: {} })
  achievements: Record<string, any>; // Achievement milestones

  @Prop({ default: false })
  isLeaderboardVisible: boolean; // Privacy setting

  @Prop({ type: [String], default: [] })
  specialTitles: string[]; // Earned titles like "Video Master", "Attendance Champion"
}

export const UserPointsSchema = SchemaFactory.createForClass(UserPoints);

// Indexes for efficient queries
UserPointsSchema.index({ user: 1, school: 1 }, { unique: true });
UserPointsSchema.index({ school: 1, totalPoints: -1 }); // Leaderboard queries
UserPointsSchema.index({ school: 1, level: -1 });
UserPointsSchema.index({ totalPoints: -1 }); // Global leaderboard
UserPointsSchema.index({ lastActivityDate: -1 });
UserPointsSchema.index({ rank: 1 });
UserPointsSchema.index({ schoolRank: 1 }); 