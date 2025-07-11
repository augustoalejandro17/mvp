import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: UserRole.STUDENT, enum: UserRole })
  role: UserRole;

  @Prop({ default: UserStatus.ACTIVE, enum: UserStatus })
  status: UserStatus;

  @Prop({ required: false })
  age?: number;

  @Prop([
    {
      status: { type: String, enum: UserStatus },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: String }, // User ID who made the change
      reason: { type: String },
    },
  ])
  statusHistory?: Array<{
    status: UserStatus;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }>;
}

export const UserSchema = SchemaFactory.createForClass(User);
