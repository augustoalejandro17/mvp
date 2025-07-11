import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import * as mongoose from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  TRIAL = 'trial',
  UNPAID = 'unpaid',
}

// Esquema para tracking de recursos extra
@Schema({ _id: false })
export class ExtraResourceUsage {
  @Prop({ default: 0 })
  extraUsers: number;

  @Prop({ default: 0 })
  extraStorageGb: number;

  @Prop({ default: 0 })
  extraStreamingMinutes: number;

  @Prop({ default: 0 })
  extraCoursesPerUser: number;
}

export const ExtraResourceUsageSchema =
  SchemaFactory.createForClass(ExtraResourceUsage);

// Esquema para registro histórico mensual
@Schema({ _id: false })
export class MonthlyUsage {
  @Prop({ required: true })
  month: number;

  @Prop({ required: true })
  year: number;

  @Prop({ default: 0 })
  usedStorageGb: number;

  @Prop({ default: 0 })
  usedStreamingMinutes: number;

  @Prop({ default: 0 })
  activeUsers: number;

  @Prop({ type: ExtraResourceUsageSchema, default: () => ({}) })
  extraUsage: ExtraResourceUsage;

  @Prop({ default: Date.now })
  lastUpdated: Date;
}

export const MonthlyUsageSchema = SchemaFactory.createForClass(MonthlyUsage);

@Schema()
export class Subscription {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true })
  plan: mongoose.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true })
  school: mongoose.Types.ObjectId;

  @Prop({
    required: true,
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop({ default: false })
  autoRenew: boolean;

  // Registro del uso actual
  @Prop({ default: 0 })
  currentStorageGb: number;

  @Prop({ default: 0 })
  currentStreamingMinutes: number;

  // Recursos extra aprobados
  @Prop({ type: ExtraResourceUsageSchema, default: () => ({}) })
  approvedExtraResources: ExtraResourceUsage;

  // Historial de uso mensual
  @Prop({ type: [MonthlyUsageSchema], default: [] })
  usageHistory: MonthlyUsage[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  lastUpdated: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
