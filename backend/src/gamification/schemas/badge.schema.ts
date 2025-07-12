import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BadgeDocument = Badge & Document;

export enum BadgeType {
  ATTENDANCE = 'attendance',
  VIDEO_WATCHING = 'video_watching',
  ENGAGEMENT = 'engagement',
  COMPLETION = 'completion',
  STREAK = 'streak',
  SPECIAL = 'special',
  MILESTONE = 'milestone',
}

export enum BadgeRarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

export interface BadgeRequirement {
  type: string;
  value: number;
  description: string;
}

@Schema({ timestamps: true })
export class Badge {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  iconUrl: string;

  @Prop({ type: String, enum: BadgeType, required: true })
  type: BadgeType;

  @Prop({ type: String, enum: BadgeRarity, default: BadgeRarity.COMMON })
  rarity: BadgeRarity;

  @Prop({ required: true })
  pointsRequired: number;

  @Prop({ required: true })
  pointsReward: number;

  @Prop({ type: Object, required: true })
  requirements: BadgeRequirement;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ required: false })
  color: string;

  @Prop({ default: false })
  isSecret: boolean; // Hidden until earned

  @Prop({ required: false })
  validFrom?: Date;

  @Prop({ required: false })
  validUntil?: Date;
}

export const BadgeSchema = SchemaFactory.createForClass(Badge); 