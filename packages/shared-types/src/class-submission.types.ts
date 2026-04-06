import { VideoMetadata, VideoStatus } from './class.types';

export enum SubmissionReviewStatus {
  SUBMITTED = 'SUBMITTED',
  REVIEWED = 'REVIEWED',
  NEEDS_RESUBMISSION = 'NEEDS_RESUBMISSION',
}

export interface IClassSubmission {
  _id?: string;
  class: string;
  course: string;
  school: string;
  student: string;
  teacher: string;
  videoUrl?: string | null;
  videoKey?: string | null;
  tempVideoKey?: string | null;
  videoStatus: VideoStatus;
  reviewStatus: SubmissionReviewStatus;
  videoProcessingError?: string | null;
  videoMetadata?: VideoMetadata;
  annotationsCount?: number;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubmissionAnnotation {
  _id?: string;
  submission: string;
  author: string;
  timestampSeconds: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClassSubmissionDto {
  classId: string;
}

export interface CreateSubmissionAnnotationDto {
  timestampSeconds: number;
  text: string;
}

export interface UpdateClassSubmissionReviewStatusDto {
  reviewStatus: SubmissionReviewStatus;
}
