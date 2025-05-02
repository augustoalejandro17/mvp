export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SCHOOL_OWNER = 'SCHOOL_OWNER',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  ADMINISTRATIVE = 'ADMINISTRATIVE'
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
} 