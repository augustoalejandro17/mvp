/**
 * Class (video lesson) related types and interfaces
 */

export enum VideoStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR',
}

export interface VideoMetadata {
  name: string;
  size: number;
  mimeType: string;
  duration?: number;
}

export interface IClass {
  _id?: string;
  title: string;
  description: string;
  videoUrl?: string;
  videoKey?: string;
  tempVideoKey?: string;
  videoStatus: VideoStatus;
  videoProcessingError?: string;
  videoMetadata?: VideoMetadata;
  teacher: string;
  course: string;
  order?: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CreateClassDto {
  title: string;
  description: string;
  courseId: string;
  order?: number;
  isPublic?: boolean;
}

export interface UpdateClassDto {
  title?: string;
  description?: string;
  order?: number;
  isPublic?: boolean;
  videoStatus?: VideoStatus;
}

