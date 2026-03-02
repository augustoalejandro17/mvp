/**
 * Plan and subscription-related types and interfaces
 */

export enum PlanType {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  PREMIUM = 'premium',
}

export interface IPlan {
  _id?: string;
  name: string;
  type: PlanType;
  description: string;
  studentSeats: number;
  teachers: number;
  maxConcurrentCoursesPerStudent: number;
  storageGB: number;
  streamingHoursPerMonth: number;
  monthlyPriceCents: number;
  overageStudentCents: number;
  overageStorageCentsPerGB: number;
  overageStreamingCentsPerHour: number;
  isActive: boolean;
  createdAt: Date;
  maxUsers: number;
  maxStorageGb: number;
  maxStreamingMinutesPerMonth: number;
  maxCoursesPerUser: number;
  monthlyPrice: number;
  isDefault: boolean;
  extraUserPrice: number;
  extraStorageGbPrice: number;
  extraStreamingMinutesPrice: number;
  extraCoursePerUserPrice: number;
  price: number;
  features: string[];
}

export interface CreatePlanDto {
  name: string;
  type: PlanType;
  description: string;
  studentSeats: number;
  teachers: number;
  maxConcurrentCoursesPerStudent: number;
  storageGB: number;
  streamingHoursPerMonth: number;
  monthlyPriceCents: number;
  overageStudentCents: number;
  overageStorageCentsPerGB: number;
  overageStreamingCentsPerHour: number;
  features?: string[];
}

export interface UpdatePlanDto {
  name?: string;
  description?: string;
  studentSeats?: number;
  teachers?: number;
  maxConcurrentCoursesPerStudent?: number;
  storageGB?: number;
  streamingHoursPerMonth?: number;
  monthlyPriceCents?: number;
  overageStudentCents?: number;
  overageStorageCentsPerGB?: number;
  overageStreamingCentsPerHour?: number;
  isActive?: boolean;
  features?: string[];
}

