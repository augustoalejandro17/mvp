import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';

export type ContentReportDocument = ContentReport & Document;

export enum ReportContentType {
  CLASS = 'class',
  COURSE = 'course',
  SCHOOL = 'school',
}

export enum ReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE = 'hate',
  SEXUAL = 'sexual',
  VIOLENCE = 'violence',
  MISINFORMATION = 'misinformation',
  COPYRIGHT = 'copyright',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  ACTION_TAKEN = 'action_taken',
  DISMISSED = 'dismissed',
}

@Schema({ timestamps: true })
export class ContentReport {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  reporter: User;

  @Prop({ type: String, enum: ReportContentType, required: true, index: true })
  contentType: ReportContentType;

  @Prop({ type: String, required: true, index: true })
  contentId: string;

  @Prop({ type: String, maxlength: 160 })
  contentTitle?: string;

  @Prop({ type: String, enum: ReportReason, required: true })
  reason: ReportReason;

  @Prop({ type: String, maxlength: 1000 })
  details?: string;

  @Prop({ type: String, enum: ReportStatus, default: ReportStatus.PENDING, index: true })
  status: ReportStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  reviewedBy?: User;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: String, maxlength: 1000 })
  moderatorNotes?: string;
}

export const ContentReportSchema = SchemaFactory.createForClass(ContentReport);

ContentReportSchema.index({ reporter: 1, contentType: 1, contentId: 1, status: 1 });
ContentReportSchema.index({ createdAt: -1 });
