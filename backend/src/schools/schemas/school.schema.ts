import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';

export type SchoolDocument = School & Document;

@Schema()
export class School {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  logoUrl: string;

  @Prop()
  address: string;

  @Prop()
  phone: string;

  @Prop()
  website: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  admin: User;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  teachers: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  students: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Course' }], default: [] })
  courses: MongooseSchema.Types.ObjectId[];

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const SchoolSchema = SchemaFactory.createForClass(School); 