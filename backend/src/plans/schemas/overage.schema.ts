import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongoose from 'mongoose';

export type OverageDocument = Overage & Document;

export enum OverageType {
  STUDENT = 'student',
  STORAGE = 'storage',
  STREAMING = 'streaming',
}

@Schema()
export class Overage {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true })
  schoolId: mongoose.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true })
  planId: mongoose.Types.ObjectId;

  @Prop({ required: true, enum: OverageType })
  type: OverageType;

  @Prop({ required: true })
  overageAmount: number; // Amount of overage (seats, GB, hours)

  @Prop({ required: true })
  unitPriceCents: number; // Price per unit in cents

  @Prop({ required: true })
  totalPriceCents: number; // Total overage cost in cents

  @Prop({ required: true })
  month: number; // 1-12

  @Prop({ required: true })
  year: number;

  @Prop({ required: true })
  recordedAt: Date;

  @Prop({ default: false })
  billed: boolean; // Whether this overage has been billed

  @Prop()
  billedAt: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' })
  invoiceId?: mongoose.Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const OverageSchema = SchemaFactory.createForClass(Overage);
