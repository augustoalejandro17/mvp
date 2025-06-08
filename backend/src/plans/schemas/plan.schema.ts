import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = Plan & Document;

export enum PlanType {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  PREMIUM = 'premium'
}

@Schema()
export class Plan {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: PlanType, default: PlanType.BASIC })
  type: PlanType;

  @Prop({ required: true })
  description: string;

  // Core plan limits (based on authoritative pricing table)
  @Prop({ required: true })
  studentSeats: number; // Any user attached to academy

  @Prop({ required: true })
  teachers: number;

  @Prop({ required: true })
  maxConcurrentCoursesPerStudent: number;

  @Prop({ required: true })
  storageGB: number;

  @Prop({ required: true })
  streamingHoursPerMonth: number;

  // Pricing (all in cents to avoid float math)
  @Prop({ required: true })
  monthlyPriceCents: number;
  
  // Over-usage unit prices (in cents)
  @Prop({ required: true })
  overageStudentCents: number;

  @Prop({ required: true })
  overageStorageCentsPerGB: number;

  @Prop({ required: true })
  overageStreamingCentsPerHour: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;

  // Legacy fields (keeping for backward compatibility)
  @Prop({ required: true })
  maxUsers: number;

  @Prop({ required: true })
  maxStorageGb: number;

  @Prop({ required: true })
  maxStreamingMinutesPerMonth: number;

  @Prop({ required: true })
  maxCoursesPerUser: number;
  
  @Prop({ required: true })
  monthlyPrice: number;
  
  @Prop({ default: false })
  isDefault: boolean;
  
  @Prop({ required: true })
  extraUserPrice: number;
  
  @Prop({ required: true })
  extraStorageGbPrice: number;
  
  @Prop({ required: true })
  extraStreamingMinutesPrice: number;
  
  @Prop({ required: true })
  extraCoursePerUserPrice: number;

  @Prop({ required: true })
  price: number;

  @Prop({ type: [String], default: [] })
  features: string[];
}

export const PlanSchema = SchemaFactory.createForClass(Plan); 