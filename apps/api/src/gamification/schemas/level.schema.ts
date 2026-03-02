import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LevelDocument = Level & Document;

export interface LevelBenefits {
  description: string;
  perks: string[];
  unlockedFeatures: string[];
  badgeUrl?: string;
  specialAccess?: string[];
}

@Schema({ timestamps: true })
export class Level {
  @Prop({ required: true, unique: true })
  level: number;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  minPoints: number;

  @Prop({ required: true })
  maxPoints: number;

  @Prop({ required: true })
  pointsRequired: number; // Points needed to reach this level

  @Prop({ type: Object, required: true })
  benefits: LevelBenefits;

  @Prop({ required: true })
  iconUrl: string;

  @Prop({ required: true })
  color: string;

  @Prop({ required: false })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  requiredBadges: string[]; // Badge IDs required to unlock this level

  @Prop({ default: 0 })
  experienceMultiplier: number; // Bonus multiplier for earning points

  @Prop({ type: Object, default: {} })
  unlockRequirements: {
    minBadges?: number;
    specificBadges?: string[];
    minStreak?: number;
    minActivity?: number;
    timeInPreviousLevel?: number; // Days
  };

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false })
  isSpecialLevel: boolean; // VIP, Premium, etc.

  @Prop({ type: [String], default: [] })
  achievements: string[]; // Special achievements unlocked at this level
}

export const LevelSchema = SchemaFactory.createForClass(Level);

// Indexes
LevelSchema.index({ level: 1 });
LevelSchema.index({ minPoints: 1 });
LevelSchema.index({ maxPoints: 1 });
LevelSchema.index({ isActive: 1 });
