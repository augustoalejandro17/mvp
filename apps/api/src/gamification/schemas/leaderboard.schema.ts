import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { School } from '../../schools/schemas/school.schema';
import { Course } from '../../courses/schemas/course.schema';

export type LeaderboardDocument = Leaderboard & Document;

export enum LeaderboardType {
  GLOBAL = 'global',
  SCHOOL = 'school',
  COURSE = 'course',
  CATEGORY = 'category',
}

export enum LeaderboardPeriod {
  ALL_TIME = 'all_time',
  YEARLY = 'yearly',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  DAILY = 'daily',
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userAvatar?: string;
  points: number;
  level: number;
  rank: number;
  previousRank?: number;
  badges: number;
  streak: number;
  lastActivity: Date;
  isActive: boolean;
  specialTitles: string[];
  rankChange?: number; // +1, -1, 0 (new, up, down, same)
}

@Schema({ timestamps: true })
export class Leaderboard {
  @Prop({ type: String, enum: LeaderboardType, required: true })
  type: LeaderboardType;

  @Prop({ type: String, enum: LeaderboardPeriod, required: true })
  period: LeaderboardPeriod;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'School', required: false })
  school?: School;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: false })
  course?: Course;

  @Prop({ required: false })
  category?: string;

  @Prop({ required: true })
  periodStart: Date;

  @Prop({ required: true })
  periodEnd: Date;

  @Prop({ type: [Object], default: [] })
  entries: LeaderboardEntry[];

  @Prop({ default: 0 })
  totalParticipants: number;

  @Prop({ required: false })
  lastUpdated?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: Object, default: {} })
  prizes: Record<string, any>; // Future rewards system

  @Prop({ default: 0 })
  version: number; // For optimistic locking

  @Prop({ type: [String], default: [] })
  excludedUsers: string[]; // Users to exclude from leaderboard

  @Prop({ default: 50 })
  maxEntries: number; // Limit number of entries shown

  @Prop({ type: Object, default: {} })
  settings: {
    showInactiveUsers?: boolean;
    minPointsToShow?: number;
    showRankChanges?: boolean;
    refreshIntervalMinutes?: number;
  };
}

export const LeaderboardSchema = SchemaFactory.createForClass(Leaderboard);

// Indexes for efficient queries
LeaderboardSchema.index({ type: 1, period: 1, school: 1 });
LeaderboardSchema.index({ type: 1, period: 1, course: 1 });
LeaderboardSchema.index({ type: 1, period: 1, category: 1 });
LeaderboardSchema.index({ periodStart: 1, periodEnd: 1 });
LeaderboardSchema.index({ isActive: 1, lastUpdated: -1 });
LeaderboardSchema.index({ 'entries.userId': 1 });
LeaderboardSchema.index({ 'entries.points': -1 });
