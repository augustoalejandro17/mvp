import { Injectable, Logger } from '@nestjs/common';

// Simple interface to avoid circular dependencies
export interface UsageHookData {
  assetId: string;
  assetType: 'video' | 'image' | 'document' | 'audio' | 'other';
  fileSizeBytes: number;
  fileName: string;
  uploadedBy: string;
  schoolId: string;
  relatedCourse?: string;
  relatedClass?: string;
}

export interface StreamingHookData {
  sessionId: string;
  userId: string;
  assetId: string;
  schoolId: string;
  relatedCourse?: string;
  relatedClass?: string;
  quality?: 'low' | 'medium' | 'high';
  deviceType?: 'mobile' | 'desktop' | 'tablet';
}

@Injectable()
export class UsageHooksService {
  private readonly logger = new Logger(UsageHooksService.name);
  
  // Static callback registry to avoid circular dependencies
  private static storageCallback: ((data: UsageHookData) => Promise<void>) | null = null;
  private static storageDeleteCallback: ((schoolId: string, assetId: string) => Promise<void>) | null = null;
  private static streamingStartCallback: ((data: StreamingHookData) => Promise<void>) | null = null;
  private static streamingEndCallback: ((schoolId: string, sessionId: string, bytes?: number) => Promise<void>) | null = null;

  /**
   * Register callbacks from the usage tracking system
   */
  static registerStorageCallback(callback: (data: UsageHookData) => Promise<void>): void {
    UsageHooksService.storageCallback = callback;
  }

  static registerStorageDeleteCallback(callback: (schoolId: string, assetId: string) => Promise<void>): void {
    UsageHooksService.storageDeleteCallback = callback;
  }

  static registerStreamingStartCallback(callback: (data: StreamingHookData) => Promise<void>): void {
    UsageHooksService.streamingStartCallback = callback;
  }

  static registerStreamingEndCallback(callback: (schoolId: string, sessionId: string, bytes?: number) => Promise<void>): void {
    UsageHooksService.streamingEndCallback = callback;
  }

  /**
   * Call from S3Service.uploadVideo() after successful upload
   */
  async trackStorageUsage(data: UsageHookData): Promise<void> {
    try {
      if (UsageHooksService.storageCallback) {
        await UsageHooksService.storageCallback(data);
        this.logger.log(`Storage usage tracked: ${data.fileName} (${data.fileSizeBytes} bytes) for school ${data.schoolId}`);
      } else {
        this.logger.warn('Storage callback not registered - usage not tracked');
      }
    } catch (error) {
      this.logger.error(`Error tracking storage usage: ${error.message}`, error.stack);
      // Don't throw to avoid breaking the main upload flow
    }
  }

  /**
   * Call from S3Service.deleteVideo() after successful deletion
   */
  async trackStorageDelete(schoolId: string, assetId: string): Promise<void> {
    try {
      if (UsageHooksService.storageDeleteCallback) {
        await UsageHooksService.storageDeleteCallback(schoolId, assetId);
        this.logger.log(`Storage deletion tracked: ${assetId} for school ${schoolId}`);
      } else {
        this.logger.warn('Storage delete callback not registered - usage not tracked');
      }
    } catch (error) {
      this.logger.error(`Error tracking storage deletion: ${error.message}`, error.stack);
    }
  }

  /**
   * Call from VideoPlayer component when streaming starts
   */
  async trackStreamingStart(data: StreamingHookData): Promise<void> {
    try {
      if (UsageHooksService.streamingStartCallback) {
        await UsageHooksService.streamingStartCallback(data);
        this.logger.log(`Streaming start tracked: ${data.sessionId} for user ${data.userId}`);
      } else {
        this.logger.warn('Streaming start callback not registered - usage not tracked');
      }
    } catch (error) {
      this.logger.error(`Error tracking streaming start: ${error.message}`, error.stack);
      throw error; // This one we might want to throw to prevent invalid sessions
    }
  }

  /**
   * Call from VideoPlayer component when streaming ends
   */
  async trackStreamingEnd(schoolId: string, sessionId: string, bytesTransferred?: number): Promise<void> {
    try {
      if (UsageHooksService.streamingEndCallback) {
        await UsageHooksService.streamingEndCallback(schoolId, sessionId, bytesTransferred);
        this.logger.log(`Streaming end tracked: ${sessionId}`);
      } else {
        this.logger.warn('Streaming end callback not registered - usage not tracked');
      }
    } catch (error) {
      this.logger.error(`Error tracking streaming end: ${error.message}`, error.stack);
    }
  }

  /**
   * Utility method to extract S3 key from URL
   */
  extractS3Key(url: string): string {
    try {
      // Handle CloudFront URLs, S3 URLs, etc.
      if (url.includes('?')) {
        url = url.split('?')[0];
      }
      
      const urlObj = new URL(url);
      
      // For CloudFront or S3 URLs, extract the path
      if (urlObj.pathname.startsWith('/')) {
        return urlObj.pathname.substring(1);
      }
      
      return urlObj.pathname;
    } catch (error) {
      this.logger.error(`Error extracting S3 key from URL: ${url}`, error);
      return url; // Fallback to original URL
    }
  }
} 