import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { Class } from '../../classes/schemas/class.schema';
import { Course } from '../../courses/schemas/course.schema';

export type ClassSubmissionDocument = ClassSubmission & Document;

export enum SubmissionVideoStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR',
}

export enum SubmissionReviewStatus {
  SUBMITTED = 'SUBMITTED',
  REVIEWED = 'REVIEWED',
  NEEDS_RESUBMISSION = 'NEEDS_RESUBMISSION',
}

@Schema({ timestamps: true })
export class ClassSubmission {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Class', required: true })
  class: Class;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: true })
  course: Course;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'School', required: true })
  school: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  student: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  teacher: User;

  @Prop()
  videoUrl?: string | null;

  @Prop()
  videoKey?: string | null;

  @Prop()
  tempVideoKey?: string | null;

  @Prop({
    type: String,
    enum: SubmissionVideoStatus,
    default: SubmissionVideoStatus.UPLOADING,
  })
  videoStatus: SubmissionVideoStatus;

  @Prop({
    type: String,
    enum: SubmissionReviewStatus,
    default: SubmissionReviewStatus.SUBMITTED,
  })
  reviewStatus: SubmissionReviewStatus;

  @Prop()
  videoProcessingError?: string | null;

  @Prop({ type: Object })
  videoMetadata?: {
    name: string;
    size: number;
    mimeType: string;
    duration?: number;
  };

  @Prop()
  submittedAt?: Date | null;

  @Prop()
  reviewedAt?: Date | null;
}

export const ClassSubmissionSchema =
  SchemaFactory.createForClass(ClassSubmission);

ClassSubmissionSchema.index({ class: 1, student: 1 }, { unique: true });
ClassSubmissionSchema.index({ class: 1, createdAt: -1 });
ClassSubmissionSchema.index({ student: 1, createdAt: -1 });
ClassSubmissionSchema.index({ teacher: 1, reviewStatus: 1, createdAt: -1 });
