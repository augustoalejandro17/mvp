import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';

export type UserReportDocument = UserReport & Document;

export enum UserReportReason {
  SPAM = 'spam',
  HARASSMENT = 'harassment',
  HATE = 'hate',
  SEXUAL = 'sexual',
  VIOLENCE = 'violence',
  IMPERSONATION = 'impersonation',
  SCAM = 'scam',
  OTHER = 'other',
}

export enum UserReportStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  ACTION_TAKEN = 'action_taken',
  DISMISSED = 'dismissed',
}

@Schema({ timestamps: true })
export class UserReport {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  reporter: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  reportedUser: User;

  @Prop({ type: String, enum: UserReportReason, required: true })
  reason: UserReportReason;

  @Prop({ type: String, maxlength: 1000 })
  details?: string;

  @Prop({ type: String, enum: UserReportStatus, default: UserReportStatus.PENDING, index: true })
  status: UserReportStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  reviewedBy?: User;

  @Prop()
  reviewedAt?: Date;

  @Prop({ type: String, maxlength: 1000 })
  moderatorNotes?: string;
}

export const UserReportSchema = SchemaFactory.createForClass(UserReport);

UserReportSchema.index({ reporter: 1, reportedUser: 1, status: 1 });
UserReportSchema.index({ createdAt: -1 });
