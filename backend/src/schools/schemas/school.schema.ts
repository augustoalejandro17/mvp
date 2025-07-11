import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import * as mongoose from 'mongoose';

export type SchoolDocument = School & Document;

@Schema()
export class School {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  logoUrl: string;

  @Prop()
  address: string;

  @Prop()
  phone: string;

  @Prop()
  website: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  admin: User;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  teachers: MongooseSchema.Types.ObjectId[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  administratives: MongooseSchema.Types.ObjectId[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }],
    default: [],
  })
  students: MongooseSchema.Types.ObjectId[];

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Course' }],
    default: [],
  })
  courses: MongooseSchema.Types.ObjectId[];

  // Plan and subscription tracking
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true })
  planId: mongoose.Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' })
  activeSubscription: mongoose.Types.ObjectId;

  // Purchased add-ons (extras)
  @Prop({ default: 0 })
  extraSeats: number;

  @Prop({ default: 0 })
  extraStorageGB: number;

  @Prop({ default: 0 })
  extraStreamingHours: number;

  // Live usage counters
  @Prop({ default: 0 })
  currentSeats: number;

  @Prop({ default: 0 })
  usedStorageGB: number;

  @Prop({ default: 0 })
  usedStreamingHours: number;

  // Legacy fields (keeping for backward compatibility)
  @Prop({ default: 0 })
  storageUsedGb: number;

  @Prop({ default: 0 })
  streamingMinutesUsed: number;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  sedes: string[];

  @Prop({ default: 'America/Bogota' }) // GMT-5 as default for Colombian schools
  timezone: string;
}

export const SchoolSchema = SchemaFactory.createForClass(School);
