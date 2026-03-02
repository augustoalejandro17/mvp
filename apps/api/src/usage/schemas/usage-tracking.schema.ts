import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UsageTrackingDocument = UsageTracking & Document;

// Individual file/asset tracking
@Schema({ _id: false })
export class AssetUsage {
  @Prop({ required: true })
  assetId: string; // S3 key or unique identifier

  @Prop({ required: true })
  assetType: 'video' | 'image' | 'document' | 'audio' | 'other';

  @Prop({ required: true })
  fileSizeBytes: number;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  uploadedBy: Types.ObjectId; // User who uploaded

  @Prop({ required: true })
  uploadedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Course' })
  relatedCourse?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Class' })
  relatedClass?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean; // For soft deletes
}

// Individual streaming session tracking
@Schema({ _id: false })
export class StreamingSession {
  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  assetId: string; // Video being streamed

  @Prop({ required: true })
  startTime: Date;

  @Prop()
  endTime?: Date;

  @Prop({ default: 0 })
  durationMinutes: number; // Calculated on session end

  @Prop({ default: 0 })
  bytesTransferred: number; // Bandwidth usage

  @Prop({ type: Types.ObjectId, ref: 'Course' })
  relatedCourse?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Class' })
  relatedClass?: Types.ObjectId;

  @Prop({ default: 'unknown' })
  quality: 'low' | 'medium' | 'high' | 'unknown'; // Video quality affects bandwidth

  @Prop({ default: 'unknown' })
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown';
}

// Monthly usage aggregation per school
@Schema()
export class UsageTracking {
  @Prop({ type: Types.ObjectId, ref: 'School', required: true })
  school: Types.ObjectId;

  @Prop({ required: true })
  month: number; // 1-12

  @Prop({ required: true })
  year: number;

  // === STORAGE TRACKING ===
  @Prop({ default: 0 })
  totalStorageBytes: number;

  @Prop({ default: 0 })
  totalStorageGB: number; // Calculated field for easier billing

  @Prop({ type: [AssetUsage], default: [] })
  assets: AssetUsage[];

  // Storage breakdown by type
  @Prop({ default: 0 })
  videoStorageBytes: number;

  @Prop({ default: 0 })
  imageStorageBytes: number;

  @Prop({ default: 0 })
  documentStorageBytes: number;

  @Prop({ default: 0 })
  otherStorageBytes: number;

  // === STREAMING TRACKING ===
  @Prop({ default: 0 })
  totalStreamingMinutes: number;

  @Prop({ default: 0 })
  totalBandwidthBytes: number;

  @Prop({ type: [StreamingSession], default: [] })
  streamingSessions: StreamingSession[];

  // Streaming breakdown
  @Prop({ default: 0 })
  uniqueViewers: number; // Count of unique users who streamed

  @Prop({ default: 0 })
  totalSessions: number;

  @Prop({ default: 0 })
  averageSessionMinutes: number;

  // === BILLING ATTRIBUTION ===
  @Prop({ type: Map, of: Number, default: {} })
  storageByUser: Map<string, number>; // UserId -> bytes for attribution

  @Prop({ type: Map, of: Number, default: {} })
  streamingByUser: Map<string, number>; // UserId -> minutes for attribution

  // === OVERAGE TRACKING ===
  @Prop({ default: 0 })
  planStorageGB: number; // What the plan allows

  @Prop({ default: 0 })
  planStreamingMinutes: number; // What the plan allows

  @Prop({ default: 0 })
  overageStorageGB: number; // How much over the limit

  @Prop({ default: 0 })
  overageStreamingMinutes: number; // How much over the limit

  @Prop({ default: 0 })
  overageStorageCost: number; // Cost in cents

  @Prop({ default: 0 })
  overageStreamingCost: number; // Cost in cents

  // === METADATA ===
  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  lastUpdated: Date;

  @Prop({ default: false })
  isFinalized: boolean; // True when month is over and billing processed

  @Prop({ default: 0 })
  billingPeriodStart: Date;

  @Prop({ default: 0 })
  billingPeriodEnd: Date;
}

export const AssetUsageSchema = SchemaFactory.createForClass(AssetUsage);
export const StreamingSessionSchema =
  SchemaFactory.createForClass(StreamingSession);
export const UsageTrackingSchema = SchemaFactory.createForClass(UsageTracking);

// Compound indexes for efficient queries
UsageTrackingSchema.index({ school: 1, year: 1, month: 1 }, { unique: true });
UsageTrackingSchema.index({ year: 1, month: 1 });
UsageTrackingSchema.index({ isFinalized: 1 });
UsageTrackingSchema.index({ lastUpdated: 1 });
