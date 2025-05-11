import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export interface AttendanceDocument extends Attendance, Document {}

@Schema({ timestamps: true })
export class Attendance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: true })
  course: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  student: MongooseSchema.Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  date: Date;

  @Prop({ type: Boolean, required: true, default: false })
  present: boolean;

  @Prop({ type: String })
  notes: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  recordedBy: MongooseSchema.Types.ObjectId;
  
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  markedBy: MongooseSchema.Types.ObjectId;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance); 