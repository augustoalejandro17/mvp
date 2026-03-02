/**
 * @inti/shared-types
 * 
 * Shared TypeScript types and interfaces for the Inti platform.
 * Used across backend API, web admin, and mobile applications.
 */

// User types
export * from './user.types';

// Course types
export * from './course.types';

// Class (video lesson) types
export * from './class.types';

// School types
export * from './school.types';

// Enrollment types
export * from './enrollment.types';

// Category types
export * from './category.types';

// Plan types
export * from './plan.types';

// Auth types
export * from './auth.types';

// Common utility types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FilterOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

