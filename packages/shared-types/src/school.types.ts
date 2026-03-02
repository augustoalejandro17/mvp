/**
 * School-related types and interfaces
 */

export interface ISchool {
  _id?: string;
  name: string;
  description: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  website?: string;
  admin?: string;
  teachers: string[];
  administratives: string[];
  students: string[];
  courses: string[];
  planId: string;
  activeSubscription?: string;
  extraSeats: number;
  extraStorageGB: number;
  extraStreamingHours: number;
  currentSeats: number;
  usedStorageGB: number;
  usedStreamingHours: number;
  storageUsedGb: number;
  streamingMinutesUsed: number;
  isPublic: boolean;
  createdAt: Date;
  isActive: boolean;
  sedes: string[];
  timezone: string;
}

export interface CreateSchoolDto {
  name: string;
  description: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  website?: string;
  planId?: string;
  sedes?: string[];
  timezone?: string;
}

