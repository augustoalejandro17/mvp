import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  SCHOOL_OWNER = 'school_owner',
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

// Esquema para roles contextuales (por escuela)
@Schema({ _id: false })
export class UserSchoolRole {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'School', required: true })
  schoolId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: UserRole })
  role: UserRole;
}

export const UserSchoolRoleSchema = SchemaFactory.createForClass(UserSchoolRole);

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  // Rol global del usuario (su rol principal)
  @Prop({ required: true, enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  // Roles contextuales por escuela (múltiples roles)
  @Prop({ type: [UserSchoolRoleSchema], default: [] })
  schoolRoles: UserSchoolRole[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Course' }], default: [] })
  enrolledCourses: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'School' }], default: [] })
  schools: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'School' }], default: [] })
  ownedSchools: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'School' }], default: [] })
  administratedSchools: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Course' }], default: [] })
  teachingCourses: MongooseSchema.Types.ObjectId[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User); 