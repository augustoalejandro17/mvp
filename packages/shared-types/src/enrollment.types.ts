/**
 * Enrollment-related types and interfaces
 */

export enum EnrollmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMPLETED = 'completed',
  DROPPED = 'dropped',
}

export interface PaymentRecord {
  amount: number;
  date: Date;
  notes?: string;
  month?: string;
}

export interface EnrollmentStatusHistory {
  status: EnrollmentStatus;
  changedAt: Date;
  changedBy: string;
  reason?: string;
}

export interface IEnrollment {
  _id?: string;
  userId: string;
  student: string;
  courseId: string;
  course: string;
  status: EnrollmentStatus;
  isActive: boolean;
  paymentStatus: boolean;
  lastPaymentDate?: Date;
  paymentNotes?: string;
  updatedBy?: string;
  paymentHistory?: PaymentRecord[];
  enrolledAt: Date;
  completedAt?: Date;
  statusHistory?: EnrollmentStatusHistory[];
}

export interface CreateEnrollmentDto {
  studentId: string;
  courseId: string;
  paymentStatus?: boolean;
  paymentNotes?: string;
}

export interface UpdateEnrollmentDto {
  status?: EnrollmentStatus;
  paymentStatus?: boolean;
  paymentNotes?: string;
  lastPaymentDate?: Date;
}

