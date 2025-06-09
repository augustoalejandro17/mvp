import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DailySnapshotDocument = DailySnapshot & Document;

@Schema({ _id: false })
export class AggregatedRow {
  @Prop({ required: true })
  id: string; // Can be ObjectId as string or age range like '18-25'

  @Prop({ required: true, default: 0 })
  revenueCents: number;

  @Prop({ required: true, default: 0 })
  present: number;

  @Prop({ required: true, default: 0 })
  absent: number;

  @Prop({ required: true, default: 0 })
  maxSeats: number;

  @Prop({ required: true, default: 0 })
  active: number;

  @Prop({ required: true, default: 0 })
  droppedToday: number;

  @Prop({ required: true, default: 0 })
  avgRetentionDays: number;
}

@Schema({ timestamps: true })
export class DailySnapshot {
  @Prop({ type: Types.ObjectId, ref: 'School', required: true })
  academyId: Types.ObjectId;

  @Prop({ required: true, type: Date })
  date: Date; // YYYY-MM-DD 00:00 UTC

  // Overall metrics for the academy
  @Prop({ required: true, default: 0 })
  revenueCents: number;

  @Prop({ required: true, default: 0 })
  presentCount: number;

  @Prop({ required: true, default: 0 })
  absentCount: number;

  @Prop({ required: true, default: 0 })
  maxSeats: number;

  @Prop({ required: true, default: 0 })
  activeCount: number;

  @Prop({ required: true, default: 0 })
  droppedToday: number;

  @Prop({ required: true, default: 0 })
  avgRetentionDays: number;

  // Aggregated data by dimensions
  @Prop({ type: [AggregatedRow], default: [] })
  byProfessor: AggregatedRow[];

  @Prop({ type: [AggregatedRow], default: [] })
  byCourse: AggregatedRow[];

  @Prop({ type: [AggregatedRow], default: [] })
  byCategory: AggregatedRow[];

  @Prop({ type: [AggregatedRow], default: [] })
  byAgeRange: AggregatedRow[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const AggregatedRowSchema = SchemaFactory.createForClass(AggregatedRow);
export const DailySnapshotSchema = SchemaFactory.createForClass(DailySnapshot);

// Create compound index for efficient queries
DailySnapshotSchema.index({ academyId: 1, date: 1 }, { unique: true });
DailySnapshotSchema.index({ date: 1 });
DailySnapshotSchema.index({ academyId: 1 }); 