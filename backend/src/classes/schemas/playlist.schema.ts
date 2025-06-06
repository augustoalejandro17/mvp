import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { Course } from '../../courses/schemas/course.schema';
import { Class } from './class.schema';

export type PlaylistDocument = Playlist & Document;

@Schema()
export class Playlist {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Course', required: true })
  course: Course;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: User;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Class' }], default: [] })
  classes: MongooseSchema.Types.ObjectId[];

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: false })
  isDefault: boolean; // Indicates if this is the default playlist for unorganized classes

  @Prop({ default: true })
  isPublic: boolean; // Indicates if this playlist is public (visible to non-enrolled users)

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const PlaylistSchema = SchemaFactory.createForClass(Playlist); 