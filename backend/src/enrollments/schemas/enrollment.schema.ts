import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum EnrollmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive', 
  COMPLETED = 'completed',
  DROPPED = 'dropped'
}

@Schema({ timestamps: true })
export class Enrollment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  courseId: Types.ObjectId;

  @Prop({ default: EnrollmentStatus.ACTIVE, enum: EnrollmentStatus })
  status: EnrollmentStatus;

  @Prop({ default: Date.now })
  enrolledAt: Date;

  @Prop()
  completedAt?: Date;

  @Prop([{
    status: { type: String, enum: EnrollmentStatus },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String }, // User ID who made the change
    reason: { type: String }
  }])
  statusHistory?: Array<{
    status: EnrollmentStatus;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }>;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// Create compound index for userId + courseId to ensure uniqueness
EnrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true }); 