import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { ClassSubmission } from './class-submission.schema';

export type SubmissionAnnotationDocument = SubmissionAnnotation & Document;

@Schema({ timestamps: true })
export class SubmissionAnnotation {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ClassSubmission',
    required: true,
  })
  submission: ClassSubmission;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  author: User;

  @Prop({ required: true, min: 0 })
  timestampSeconds: number;

  @Prop({ required: true, trim: true, maxlength: 1500 })
  text: string;
}

export const SubmissionAnnotationSchema =
  SchemaFactory.createForClass(SubmissionAnnotation);

SubmissionAnnotationSchema.index({
  submission: 1,
  timestampSeconds: 1,
  createdAt: 1,
});
