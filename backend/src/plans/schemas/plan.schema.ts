import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = Plan & Document;

export enum PlanType {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  PREMIUM = 'premium',
  CUSTOM = 'custom'
}

@Schema()
export class Plan {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: PlanType, default: PlanType.BASIC })
  type: PlanType;

  @Prop({ required: true })
  description: string;

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

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const PlanSchema = SchemaFactory.createForClass(Plan); 