import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'users' })
export class User {
  _id: any;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  profileImageUrl?: string;

  @Prop({ default: 'student' })
  role: string;

  @Prop({ default: true })
  isActive: boolean;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
