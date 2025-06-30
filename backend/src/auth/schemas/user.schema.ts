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

// Enum for onboarding steps
export enum OnboardingStep {
  WELCOME = 'welcome',
  USER_TYPE_SELECTION = 'user_type_selection',
  PROFILE_COMPLETION = 'profile_completion',
  SCHOOL_SETUP = 'school_setup',
  QUICK_TOUR = 'quick_tour',
  COMPLETED = 'completed'
}

// Schema for onboarding progress tracking
@Schema({ _id: false })
export class OnboardingProgress {
  @Prop({ type: String, enum: Object.values(OnboardingStep), default: OnboardingStep.WELCOME })
  currentStep: OnboardingStep;

  @Prop({ type: [String], enum: Object.values(OnboardingStep), default: [] })
  completedSteps: OnboardingStep[];

  @Prop({ default: Date.now })
  startedAt: Date;

  @Prop({ required: false })
  completedAt?: Date;

  @Prop({ default: false })
  isCompleted: boolean;

  @Prop({ type: Map, of: mongoose.Schema.Types.Mixed, default: {} })
  stepData: Map<string, any>; // Store step-specific data like profile completion progress
}

export const OnboardingProgressSchema = SchemaFactory.createForClass(OnboardingProgress);

// Esquema para roles contextuales (por escuela)
@Schema({ _id: false })
export class UserSchoolRole {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true })
  schoolId: mongoose.Types.ObjectId;

  @Prop({ required: true, type: String, enum: Object.values(UserRole) })
  role: string;

  @Prop({ type: String, required: false }) // Optional Sede/branch for this role
  sede?: string;
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

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  // Onboarding fields
  @Prop({ default: false })
  hasOnboarded: boolean;

  @Prop({ type: OnboardingProgressSchema, default: () => ({}) })
  onboardingProgress: OnboardingProgress;

  @Prop({ required: false })
  dateOfBirth?: Date;

  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  profileImageUrl?: string;

  @Prop({ required: false })
  bio?: string;

  // Profile completion tracking
  @Prop({ default: 0, min: 0, max: 100 })
  profileCompletionPercentage: number;

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

  @Prop({ required: false })
  age?: number;

  // Session management for single device login
  @Prop({ required: false })
  currentSessionId?: string;

  @Prop({ required: false })
  lastLoginAt?: Date;

  @Prop({ required: false })
  sessionExpiredAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User); 