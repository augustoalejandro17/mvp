import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { Course } from '../../courses/schemas/course.schema';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  CLASS_REMINDER = 'class_reminder',
  ENROLLMENT = 'enrollment',
  PAYMENT_DUE = 'payment_due',
  GENERAL = 'general',
  SYSTEM = 'system',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({
    type: String,
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  recipient: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  sender?: User;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course' })
  relatedCourse?: Course;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: Date })
  scheduledFor?: Date; // For scheduled notifications

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object })
  metadata?: {
    classStartTime?: Date;
    courseId?: string;
    actionUrl?: string;
    [key: string]: any;
  };
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
