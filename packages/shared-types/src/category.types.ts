/**
 * Category-related types and interfaces
 */

export interface ICategory {
  _id?: string;
  name: string;
  description?: string;
  parentCategory?: string;
  isActive: boolean;
  sortOrder: number;
  color?: string;
  icon?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  parentCategory?: string;
  sortOrder?: number;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  description?: string;
  parentCategory?: string;
  isActive?: boolean;
  sortOrder?: number;
  color?: string;
  icon?: string;
}

