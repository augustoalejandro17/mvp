import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AttendanceDocument = Attendance & Document;

@Schema()
export class Attendance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: true })
  course: MongooseSchema.Types.ObjectId;

  @Prop({ 
    type: MongooseSchema.Types.Mixed, 
    required: true,
    // Puede ser un ObjectId (usuario registrado) o un string (no registrado)
    ref: 'User',
    refPath: 'studentModel'
  })
  student: MongooseSchema.Types.ObjectId | string;

  @Prop({ type: String, default: 'User', enum: ['User', 'String'] })
  studentModel: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: true })
  present: boolean;

  @Prop({ type: String })
  notes: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  markedBy: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  recordedBy: MongooseSchema.Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: 0 })
  studentsPresent: number;

  @Prop({ default: 0 })
  totalStudents: number;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance); 