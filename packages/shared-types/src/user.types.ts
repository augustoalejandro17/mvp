/**
 * User-related types and enums
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SCHOOL_OWNER = 'school_owner',
  TEACHER = 'teacher',
  STUDENT = 'student',
  ADMINISTRATIVE = 'administrative',
  UNREGISTERED = 'unregistered',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

export enum OnboardingStep {
  WELCOME = 'welcome',
  USER_TYPE_SELECTION = 'user_type_selection',
  PROFILE_COMPLETION = 'profile_completion',
  SCHOOL_SETUP = 'school_setup',
  QUICK_TOUR = 'quick_tour',
  COMPLETED = 'completed',
}

export interface OnboardingProgress {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  startedAt: Date;
  completedAt?: Date;
  isCompleted: boolean;
  stepData: Record<string, any>;
}

export interface UserSchoolRole {
  schoolId: string;
  role: string;
  sede?: string;
}

export interface IUser {
  _id?: string;
  email: string;
  password?: string;
  name: string;
  provider: AuthProvider;
  googleId?: string;
  providerId?: string;
  firstName?: string;
  lastName?: string;
  hasOnboarded: boolean;
  onboardingProgress?: OnboardingProgress;
  dateOfBirth?: Date;
  phone?: string;
  profileImageUrl?: string;
  bio?: string;
  profileCompletionPercentage: number;
  role: UserRole;
  canCreateSchool?: boolean;
  schoolRoles: UserSchoolRole[];
  enrolledCourses: string[];
  schools: string[];
  ownedSchools: string[];
  administratedSchools: string[];
  teachingCourses: string[];
  createdAt: Date;
  isActive: boolean;
  age?: number;
  currentSessionId?: string;
  lastLoginAt?: Date;
  sessionExpiredAt?: Date;
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export interface UserStatusHistory {
  status: UserStatus;
  changedAt: Date;
  changedBy: string;
  reason?: string;
}
