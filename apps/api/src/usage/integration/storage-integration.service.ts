import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  UsageTrackingService,
  StorageTrackingOptions,
} from '../usage-tracking.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageIntegrationService {
  private readonly logger = new Logger(StorageIntegrationService.name);

  constructor(private readonly usageTrackingService: UsageTrackingService) {}

  /**
   * Hook for S3Service.uploadVideo()
   * Call this after successful video upload
   */
  async trackVideoUpload(
    s3Key: string,
    fileSizeBytes: number,
    fileName: string,
    uploadedBy: string,
    schoolId: string,
    relatedCourse?: string,
    relatedClass?: string,
  ): Promise<void> {
    try {
      const trackingOptions: StorageTrackingOptions = {
        assetId: s3Key,
        assetType: 'video',
        fileSizeBytes,
        fileName,
        uploadedBy,
        schoolId,
        relatedCourse,
        relatedClass,
      };

      await this.usageTrackingService.trackStorageUsage(trackingOptions);
      this.logger.log(
        `Video upload tracked: ${fileName} (${fileSizeBytes} bytes) for school ${schoolId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error tracking video upload: ${error.message}`,
        error.stack,
      );
      // Don't throw error to avoid breaking the main upload flow
    }
  }

  /**
   * Hook for S3Service.uploadImage()
   * Call this after successful image upload
   */
  async trackImageUpload(
    s3Key: string,
    fileSizeBytes: number,
    fileName: string,
    uploadedBy: string,
    schoolId: string,
    relatedCourse?: string,
    relatedClass?: string,
  ): Promise<void> {
    try {
      const trackingOptions: StorageTrackingOptions = {
        assetId: s3Key,
        assetType: 'image',
        fileSizeBytes,
        fileName,
        uploadedBy,
        schoolId,
        relatedCourse,
        relatedClass,
      };

      await this.usageTrackingService.trackStorageUsage(trackingOptions);
      this.logger.log(
        `Image upload tracked: ${fileName} (${fileSizeBytes} bytes) for school ${schoolId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error tracking image upload: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Hook for document uploads
   */
  async trackDocumentUpload(
    s3Key: string,
    fileSizeBytes: number,
    fileName: string,
    uploadedBy: string,
    schoolId: string,
    relatedCourse?: string,
    relatedClass?: string,
  ): Promise<void> {
    try {
      const trackingOptions: StorageTrackingOptions = {
        assetId: s3Key,
        assetType: 'document',
        fileSizeBytes,
        fileName,
        uploadedBy,
        schoolId,
        relatedCourse,
        relatedClass,
      };

      await this.usageTrackingService.trackStorageUsage(trackingOptions);
      this.logger.log(
        `Document upload tracked: ${fileName} (${fileSizeBytes} bytes) for school ${schoolId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error tracking document upload: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Hook for file deletion
   * Call this when files are deleted from S3
   */
  async trackFileDelete(s3Key: string, schoolId: string): Promise<void> {
    try {
      await this.usageTrackingService.removeStorageUsage(schoolId, s3Key);
      this.logger.log(`File deletion tracked: ${s3Key} for school ${schoolId}`);
    } catch (error) {
      this.logger.error(
        `Error tracking file deletion: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Helper to determine school from context
   * Priority: explicit schoolId > course school > class course school > user's first school
   */
  async determineSchoolForAttribution(
    uploadedBy: string,
    relatedCourse?: string,
    relatedClass?: string,
    explicitSchoolId?: string,
  ): Promise<string> {
    if (explicitSchoolId) {
      return explicitSchoolId;
    }

    // This logic would be moved here from the main service
    // For now, return the first parameter that's available
    if (relatedCourse) {
      // In a real implementation, you'd query the course to get its school
      // return await this.getSchoolFromCourse(relatedCourse);
    }

    if (relatedClass) {
      // In a real implementation, you'd query the class to get its course's school
      // return await this.getSchoolFromClass(relatedClass);
    }

    // Fallback: use user's first school
    // return await this.getUserFirstSchool(uploadedBy);

    throw new BadRequestException(
      'Could not determine school for attribution. Please provide explicit schoolId.',
    );
  }
}
