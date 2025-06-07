export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SCHOOL_OWNER = 'SCHOOL_OWNER',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  ADMINISTRATIVE = 'ADMINISTRATIVE'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum EnrollmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMPLETED = 'completed',
  DROPPED = 'dropped'
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status?: UserStatus;
  age?: number;
  createdAt: string;
  updatedAt: string;
  statusHistory?: Array<{
    status: UserStatus;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }>;
}

export interface Enrollment {
  _id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: Date;
  completedAt?: Date;
  statusHistory?: Array<{
    status: EnrollmentStatus;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }>;
} 