import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { School } from '../../schools/schemas/school.schema';

export type CourseDocument = Course & Document;

@Schema()
export class Course {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  coverImageUrl: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'School', required: true })
  school: School;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  teacher: User;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  teachers: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Class' }], default: [] })
  classes: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }], default: [] })
  students: MongooseSchema.Types.ObjectId[];

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: 999 })
  promotionOrder: number;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const CourseSchema = SchemaFactory.createForClass(Course); 