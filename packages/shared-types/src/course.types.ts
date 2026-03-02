/**
 * Course-related types and interfaces
 */

export interface ICourse {
  _id?: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  school: string;
  sede?: string;
  teacher: string;
  teachers: string[];
  categories: string[];
  classes: string[];
  students: string[];
  isPublic: boolean;
  promotionOrder: number;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CreateCourseDto {
  title: string;
  description: string;
  coverImageUrl?: string;
  schoolId: string;
  sede?: string;
  teacherId?: string;
  categories?: string[];
  isPublic?: boolean;
}

export interface UpdateCourseDto {
  title?: string;
  description?: string;
  coverImageUrl?: string;
  sede?: string;
  categories?: string[];
  isPublic?: boolean;
  promotionOrder?: number;
  isFeatured?: boolean;
  isActive?: boolean;
}

export interface ICourseSchedule {
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

