import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type EnrollmentDocument = Enrollment & Document;

// Esquema para pagos mensuales
@Schema({ timestamps: true })
export class MonthlyPayment {
  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: '' })
  notes: string;

  @Prop({ type: String })
  month: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  registeredBy: MongooseSchema.Types.ObjectId;
}

export const MonthlyPaymentSchema =
  SchemaFactory.createForClass(MonthlyPayment);

@Schema({ timestamps: true })
export class Enrollment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  student: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: true })
  course: MongooseSchema.Types.ObjectId;

  @Prop({ default: false })
  paymentStatus: boolean;

  @Prop({ type: Date })
  lastPaymentDate: Date;

  @Prop({ type: String })
  paymentNotes: string;

  @Prop({ type: [MonthlyPaymentSchema], default: [] })
  paymentHistory: MonthlyPayment[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  updatedBy: MongooseSchema.Types.ObjectId;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);
