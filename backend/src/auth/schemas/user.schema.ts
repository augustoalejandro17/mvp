import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import * as mongoose from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SCHOOL_OWNER = 'school_owner',
  TEACHER = 'teacher',
  STUDENT = 'student',
  ADMINISTRATIVE = 'administrative',
  UNREGISTERED = 'unregistered'
}

// Esquema para roles contextuales (por escuela)
@Schema({ _id: false })
export class UserSchoolRole {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true })
  schoolId: mongoose.Types.ObjectId;

  @Prop({ required: true, type: String, enum: Object.values(UserRole) })
  role: string;
}

export const UserSchoolRoleSchema = SchemaFactory.createForClass(UserSchoolRole);

@Schema()
export class User {
  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop()
  password: string;

  @Prop({ required: true })
  name: string;

  // Rol global del usuario (su rol principal)
  @Prop({ required: true, enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  // Roles contextuales por escuela (múltiples roles)
  @Prop({ type: [UserSchoolRoleSchema], default: [] })
  schoolRoles: UserSchoolRole[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }], default: [] })
  enrolledCourses: mongoose.Types.ObjectId[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }], default: [] })
  schools: mongoose.Types.ObjectId[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }], default: [] })
  ownedSchools: mongoose.Types.ObjectId[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }], default: [] })
  administratedSchools: mongoose.Types.ObjectId[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }], default: [] })
  teachingCourses: mongoose.Types.ObjectId[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User); 