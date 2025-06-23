import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { Course } from '../../courses/schemas/course.schema';

export type ClassDocument = Class & Document;

export enum VideoStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR'
}

@Schema()
export class Class {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  videoUrl: string;

  @Prop()
  videoKey: string;

  @Prop()
  tempVideoKey: string;

  @Prop({ type: String, enum: VideoStatus, default: VideoStatus.UPLOADING })
  videoStatus: VideoStatus;

  @Prop()
  videoProcessingError: string;

  @Prop({ type: Object })
  videoMetadata: {
    name: string;
    size: number;
    mimeType: string;
    duration?: number;
  };

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  teacher: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: true })
  course: Course;

  @Prop()
  order: number;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const ClassSchema = SchemaFactory.createForClass(Class); 