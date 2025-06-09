import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UsageHooksService, UsageHookData, StreamingHookData } from './hooks/usage-hooks.service';
import { StorageIntegrationService } from './integration/storage-integration.service';
import { StreamingIntegrationService } from './integration/streaming-integration.service';

@Injectable()
export class UsageInitializationService implements OnModuleInit {
  private readonly logger = new Logger(UsageInitializationService.name);

  constructor(
    private readonly storageIntegrationService: StorageIntegrationService,
    private readonly streamingIntegrationService: StreamingIntegrationService,
  ) {}

  /**
   * Register all usage tracking callbacks when the module initializes
   */
  async onModuleInit(): Promise<void> {
    try {
      // Register storage tracking callback
      UsageHooksService.registerStorageCallback(async (data: UsageHookData) => {
        await this.storageIntegrationService.trackVideoUpload(
          data.assetId,
          data.fileSizeBytes,
          data.fileName,
          data.uploadedBy,
          data.schoolId,
          data.relatedCourse,
          data.relatedClass
        );
      });

      // Register storage deletion callback
      UsageHooksService.registerStorageDeleteCallback(async (schoolId: string, assetId: string) => {
        await this.storageIntegrationService.trackFileDelete(assetId, schoolId);
      });

      // Register streaming start callback
      UsageHooksService.registerStreamingStartCallback(async (data: StreamingHookData) => {
        await this.streamingIntegrationService.startVideoStreaming(
          data.userId,
          data.assetId,
          data.schoolId,
          data.relatedCourse,
          data.relatedClass,
          data.quality,
          data.deviceType
        );
      });

      // Register streaming end callback
      UsageHooksService.registerStreamingEndCallback(async (schoolId: string, sessionId: string, bytes?: number) => {
        await this.streamingIntegrationService.endVideoStreaming(sessionId, bytes);
      });

      this.logger.log('Usage tracking callbacks registered successfully');
    } catch (error) {
      this.logger.error('Error registering usage tracking callbacks:', error);
      throw error;
    }
  }
} 