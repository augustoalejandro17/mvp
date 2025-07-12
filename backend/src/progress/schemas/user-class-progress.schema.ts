import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { Class } from '../../classes/schemas/class.schema';
import { Course } from '../../courses/schemas/course.schema';

export type UserClassProgressDocument = UserClassProgress & Document;

@Schema({ timestamps: true })
export class UserClassProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ type: Types.ObjectId, ref: 'Class', required: true })
  class: Class;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  course: Course;

  @Prop({ type: Types.ObjectId, ref: 'School', required: true })
  school: Types.ObjectId;

  @Prop({ default: false })
  completed: boolean;

  @Prop({ default: 0, min: 0, max: 100 })
  videoWatchPercentage: number;

  @Prop({ default: 0 })
  timeSpentMinutes: number;

  @Prop()
  completedAt?: Date;

  @Prop({ default: Date.now })
  firstAccessedAt: Date;

  @Prop({ default: Date.now })
  lastAccessedAt: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>; // Store additional completion data

  @Prop({ default: false })
  attendanceMarked: boolean; // Track if attendance was marked for this class

  @Prop()
  attendanceDate?: Date;

  @Prop({ type: String, enum: ['present', 'late', 'absent'] })
  attendanceStatus?: string;
}

export const UserClassProgressSchema = SchemaFactory.createForClass(UserClassProgress);

// Create compound index for efficient queries
UserClassProgressSchema.index({ user: 1, class: 1 }, { unique: true });
UserClassProgressSchema.index({ user: 1, course: 1 });
UserClassProgressSchema.index({ course: 1, completed: 1 });
UserClassProgressSchema.index({ user: 1, school: 1 }); 