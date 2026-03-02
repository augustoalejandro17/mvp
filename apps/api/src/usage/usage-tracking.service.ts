import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UsageTracking,
  UsageTrackingDocument,
  AssetUsage,
  StreamingSession,
} from './schemas/usage-tracking.schema';
import { User } from '../auth/schemas/user.schema';
import { School } from '../schools/schemas/school.schema';
import { Course } from '../courses/schemas/course.schema';
import { Class } from '../classes/schemas/class.schema';
import { Plan } from '../plans/schemas/plan.schema';
import { Subscription } from '../plans/schemas/subscription.schema';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';

export interface StorageTrackingOptions {
  assetId: string;
  assetType: 'video' | 'image' | 'document' | 'audio' | 'other';
  fileSizeBytes: number;
  fileName: string;
  uploadedBy: string; // User ID
  schoolId: string;
  relatedCourse?: string;
  relatedClass?: string;
}

export interface StreamingTrackingOptions {
  sessionId: string;
  userId: string;
  assetId: string;
  schoolId: string;
  relatedCourse?: string;
  relatedClass?: string;
  quality?: 'low' | 'medium' | 'high';
  deviceType?: 'mobile' | 'desktop' | 'tablet';
}

export interface UsageSummary {
  storageGB: number;
  streamingMinutes: number;
  overageStorageGB: number;
  overageStreamingMinutes: number;
  overageStorageCost: number;
  overageStreamingCost: number;
  totalOverageCost: number;
  planLimits: {
    storageGB: number;
    streamingMinutes: number;
  };
}

@Injectable()
export class UsageTrackingService {
  private readonly logger = new Logger(UsageTrackingService.name);
  private readonly s3: S3;
  private readonly bucketName: string;

  constructor(
    @InjectModel(UsageTracking.name)
    private usageModel: Model<UsageTrackingDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    private configService: ConfigService,
  ) {
    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('aws.accessKeyId'),
      secretAccessKey: this.configService.get<string>('aws.secretAccessKey'),
      region: this.configService.get<string>('aws.region'),
    });
    this.bucketName = this.configService.get<string>('aws.s3.bucketName');
  }

  // ========================================
  // STORAGE TRACKING
  // ========================================

  /**
   * Track storage usage when a file is uploaded
   */
  async trackStorageUsage(options: StorageTrackingOptions): Promise<void> {
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      // Get or create usage document for this school/month
      let usageDoc = await this.usageModel
        .findOne({
          school: new Types.ObjectId(options.schoolId),
          month,
          year,
        })
        .exec();

      if (!usageDoc) {
        usageDoc = (await this.createNewUsageDocument(
          options.schoolId,
          month,
          year,
        )) as any;
      }

      // Create asset usage record
      const assetUsage: AssetUsage = {
        assetId: options.assetId,
        assetType: options.assetType,
        fileSizeBytes: options.fileSizeBytes,
        fileName: options.fileName,
        uploadedBy: new Types.ObjectId(options.uploadedBy),
        uploadedAt: currentDate,
        relatedCourse: options.relatedCourse
          ? new Types.ObjectId(options.relatedCourse)
          : undefined,
        relatedClass: options.relatedClass
          ? new Types.ObjectId(options.relatedClass)
          : undefined,
        isActive: true,
      };

      // Add to assets array
      usageDoc.assets.push(assetUsage);

      // Update totals
      usageDoc.totalStorageBytes += options.fileSizeBytes;
      usageDoc.totalStorageGB =
        usageDoc.totalStorageBytes / (1024 * 1024 * 1024);

      // Update breakdown by type
      switch (options.assetType) {
        case 'video':
          usageDoc.videoStorageBytes += options.fileSizeBytes;
          break;
        case 'image':
          usageDoc.imageStorageBytes += options.fileSizeBytes;
          break;
        case 'document':
          usageDoc.documentStorageBytes += options.fileSizeBytes;
          break;
        default:
          usageDoc.otherStorageBytes += options.fileSizeBytes;
      }

      // Update user attribution
      const currentUserUsage =
        usageDoc.storageByUser.get(options.uploadedBy) || 0;
      usageDoc.storageByUser.set(
        options.uploadedBy,
        currentUserUsage + options.fileSizeBytes,
      );

      // Calculate overages
      await this.calculateStorageOverage(usageDoc);

      usageDoc.lastUpdated = currentDate;
      await usageDoc.save();

      this.logger.log(
        `Storage usage tracked: ${options.fileName} (${options.fileSizeBytes} bytes) for school ${options.schoolId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error tracking storage usage: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Remove storage usage when a file is deleted
   */
  async removeStorageUsage(schoolId: string, assetId: string): Promise<void> {
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const usageDoc = await this.usageModel
        .findOne({
          school: new Types.ObjectId(schoolId),
          month,
          year,
        })
        .exec();

      if (!usageDoc) {
        this.logger.warn(
          `No usage document found for school ${schoolId} in ${month}/${year}`,
        );
        return;
      }

      // Find and remove the asset
      const assetIndex = usageDoc.assets.findIndex(
        (asset) => asset.assetId === assetId && asset.isActive,
      );
      if (assetIndex === -1) {
        this.logger.warn(
          `Asset ${assetId} not found in usage tracking for school ${schoolId}`,
        );
        return;
      }

      const asset = usageDoc.assets[assetIndex];

      // Mark as inactive (soft delete for audit trail)
      asset.isActive = false;

      // Update totals
      usageDoc.totalStorageBytes -= asset.fileSizeBytes;
      usageDoc.totalStorageGB = Math.max(
        0,
        usageDoc.totalStorageBytes / (1024 * 1024 * 1024),
      );

      // Update breakdown by type
      switch (asset.assetType) {
        case 'video':
          usageDoc.videoStorageBytes = Math.max(
            0,
            usageDoc.videoStorageBytes - asset.fileSizeBytes,
          );
          break;
        case 'image':
          usageDoc.imageStorageBytes = Math.max(
            0,
            usageDoc.imageStorageBytes - asset.fileSizeBytes,
          );
          break;
        case 'document':
          usageDoc.documentStorageBytes = Math.max(
            0,
            usageDoc.documentStorageBytes - asset.fileSizeBytes,
          );
          break;
        default:
          usageDoc.otherStorageBytes = Math.max(
            0,
            usageDoc.otherStorageBytes - asset.fileSizeBytes,
          );
      }

      // Update user attribution
      const userId = asset.uploadedBy.toString();
      const currentUserUsage = usageDoc.storageByUser.get(userId) || 0;
      usageDoc.storageByUser.set(
        userId,
        Math.max(0, currentUserUsage - asset.fileSizeBytes),
      );

      // Recalculate overages
      await this.calculateStorageOverage(usageDoc);

      usageDoc.lastUpdated = currentDate;
      await usageDoc.save();

      this.logger.log(
        `Storage usage removed: ${assetId} for school ${schoolId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error removing storage usage: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ========================================
  // STREAMING TRACKING
  // ========================================

  /**
   * Start tracking a streaming session
   */
  async startStreamingSession(
    options: StreamingTrackingOptions,
  ): Promise<void> {
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      // Get or create usage document
      let usageDoc = await this.usageModel
        .findOne({
          school: new Types.ObjectId(options.schoolId),
          month,
          year,
        })
        .exec();

      if (!usageDoc) {
        usageDoc = (await this.createNewUsageDocument(
          options.schoolId,
          month,
          year,
        )) as any;
      }

      // Create streaming session record
      const streamingSession: StreamingSession = {
        sessionId: options.sessionId,
        userId: new Types.ObjectId(options.userId),
        assetId: options.assetId,
        startTime: currentDate,
        durationMinutes: 0,
        bytesTransferred: 0,
        relatedCourse: options.relatedCourse
          ? new Types.ObjectId(options.relatedCourse)
          : undefined,
        relatedClass: options.relatedClass
          ? new Types.ObjectId(options.relatedClass)
          : undefined,
        quality: options.quality || 'unknown',
        deviceType: options.deviceType || 'unknown',
      };

      usageDoc.streamingSessions.push(streamingSession);
      usageDoc.lastUpdated = currentDate;
      await usageDoc.save();

      this.logger.log(
        `Streaming session started: ${options.sessionId} for user ${options.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error starting streaming session: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * End a streaming session and calculate usage
   */
  async endStreamingSession(
    schoolId: string,
    sessionId: string,
    bytesTransferred?: number,
  ): Promise<void> {
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const usageDoc = await this.usageModel
        .findOne({
          school: new Types.ObjectId(schoolId),
          month,
          year,
        })
        .exec();

      if (!usageDoc) {
        this.logger.warn(
          `No usage document found for school ${schoolId} when ending session ${sessionId}`,
        );
        return;
      }

      // Find the streaming session
      const session = usageDoc.streamingSessions.find(
        (s) => s.sessionId === sessionId && !s.endTime,
      );
      if (!session) {
        this.logger.warn(
          `Active streaming session ${sessionId} not found for school ${schoolId}`,
        );
        return;
      }

      // Calculate duration (store as fractional minutes for accuracy)
      session.endTime = currentDate;
      const sessionDurationMs =
        currentDate.getTime() - session.startTime.getTime();
      session.durationMinutes = sessionDurationMs / 60000; // Don't round - keep fractional minutes
      session.bytesTransferred = bytesTransferred || 0;

      this.logger.log(
        `Session ${sessionId} duration: ${sessionDurationMs}ms = ${session.durationMinutes.toFixed(2)} minutes, bytes: ${session.bytesTransferred}`,
      );

      // Update totals (round to 2 decimal places for storage)
      usageDoc.totalStreamingMinutes +=
        Math.round(session.durationMinutes * 100) / 100;
      usageDoc.totalBandwidthBytes += session.bytesTransferred;
      usageDoc.totalSessions += 1;

      // Update user attribution
      const userId = session.userId.toString();
      const currentUserUsage = usageDoc.streamingByUser.get(userId) || 0;
      usageDoc.streamingByUser.set(
        userId,
        Math.round((currentUserUsage + session.durationMinutes) * 100) / 100,
      );

      // Update unique viewers count
      const uniqueUserIds = new Set(
        usageDoc.streamingSessions
          .filter((s) => s.endTime) // Only completed sessions
          .map((s) => s.userId.toString()),
      );
      usageDoc.uniqueViewers = uniqueUserIds.size;

      // Calculate average session duration
      const completedSessions = usageDoc.streamingSessions.filter(
        (s) => s.endTime,
      );
      const totalMinutes = completedSessions.reduce(
        (sum, s) => sum + s.durationMinutes,
        0,
      );
      usageDoc.averageSessionMinutes =
        completedSessions.length > 0
          ? Math.round((totalMinutes / completedSessions.length) * 100) / 100
          : 0;

      // Calculate streaming overages
      await this.calculateStreamingOverage(usageDoc);

      usageDoc.lastUpdated = currentDate;
      await usageDoc.save();

      this.logger.log(
        `Streaming session ended: ${sessionId} (${session.durationMinutes} minutes)`,
      );
    } catch (error) {
      this.logger.error(
        `Error ending streaming session: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ========================================
  // BILLING AND OVERAGE CALCULATIONS
  // ========================================

  private async calculateStorageOverage(
    usageDoc: UsageTrackingDocument,
  ): Promise<void> {
    try {
      const subscription = await this.subscriptionModel
        .findOne({ school: usageDoc.school })
        .populate('plan')
        .exec();

      if (!subscription || !subscription.plan) {
        this.logger.warn(`No subscription found for school ${usageDoc.school}`);
        return;
      }

      const plan = subscription.plan as any;
      const planStorageGB = plan.storageGB || plan.maxStorageGb || 0;
      const extraStorageGB =
        subscription.approvedExtraResources?.extraStorageGb || 0;
      const totalAllowedGB = planStorageGB + extraStorageGB;

      usageDoc.planStorageGB = totalAllowedGB;
      usageDoc.overageStorageGB = Math.max(
        0,
        usageDoc.totalStorageGB - totalAllowedGB,
      );

      // Calculate overage cost
      const overageRate =
        plan.overageStorageCentsPerGB || plan.extraStorageGbPrice * 100 || 20; // Default $0.20/GB
      usageDoc.overageStorageCost = Math.round(
        usageDoc.overageStorageGB * overageRate,
      );
    } catch (error) {
      this.logger.error('Error calculating storage overage:', error);
    }
  }

  private async calculateStreamingOverage(
    usageDoc: UsageTrackingDocument,
  ): Promise<void> {
    try {
      const subscription = await this.subscriptionModel
        .findOne({ school: usageDoc.school })
        .populate('plan')
        .exec();

      if (!subscription || !subscription.plan) {
        this.logger.warn(`No subscription found for school ${usageDoc.school}`);
        return;
      }

      const plan = subscription.plan as any;
      const planStreamingMinutes =
        (plan.streamingHoursPerMonth || 0) * 60 ||
        plan.maxStreamingMinutesPerMonth ||
        0;
      const extraStreamingMinutes =
        subscription.approvedExtraResources?.extraStreamingMinutes || 0;
      const totalAllowedMinutes = planStreamingMinutes + extraStreamingMinutes;

      usageDoc.planStreamingMinutes = totalAllowedMinutes;
      usageDoc.overageStreamingMinutes = Math.max(
        0,
        usageDoc.totalStreamingMinutes - totalAllowedMinutes,
      );

      // Calculate overage cost (convert hour rate to minute rate)
      const overageRatePerHour = plan.overageStreamingCentsPerHour || 6; // Default $0.06/hour
      const overageRatePerMinute = overageRatePerHour / 60;
      usageDoc.overageStreamingCost = Math.round(
        usageDoc.overageStreamingMinutes * overageRatePerMinute,
      );
    } catch (error) {
      this.logger.error('Error calculating streaming overage:', error);
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  private async createNewUsageDocument(
    schoolId: string,
    month: number,
    year: number,
  ): Promise<UsageTrackingDocument & { _id: any }> {
    const newUsageDoc = new this.usageModel({
      school: new Types.ObjectId(schoolId),
      month,
      year,
      billingPeriodStart: new Date(year, month - 1, 1),
      billingPeriodEnd: new Date(year, month, 0, 23, 59, 59, 999),
      assets: [],
      streamingSessions: [],
      storageByUser: new Map(),
      streamingByUser: new Map(),
    });

    const savedDoc = await newUsageDoc.save();
    return savedDoc as UsageTrackingDocument & { _id: any };
  }

  /**
   * Get usage summary for a school in a specific month
   */
  async getUsageSummary(
    schoolId: string,
    month?: number,
    year?: number,
  ): Promise<any> {
    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    const usageDoc = await this.usageModel
      .findOne({
        school: new Types.ObjectId(schoolId),
        month: targetMonth,
        year: targetYear,
      })
      .exec();

    if (!usageDoc) {
      // Return empty usage if no document exists
      const subscription = await this.subscriptionModel
        .findOne({ school: new Types.ObjectId(schoolId) })
        .populate('plan')
        .exec();

      const plan = subscription?.plan as any;
      const planStorageGB = plan?.storageGB || plan?.maxStorageGb || 0;
      const planStreamingMinutes =
        (plan?.streamingHoursPerMonth || 0) * 60 ||
        plan?.maxStreamingMinutesPerMonth ||
        0;

      return {
        period: `${targetMonth}/${targetYear}`,
        totalStorageUsed: 0,
        totalStorageLimit: planStorageGB,
        totalStreamingUsed: 0,
        totalStreamingLimit: planStreamingMinutes,
        storageOverage: 0,
        streamingOverage: 0,
        storageCost: 0,
        streamingCost: 0,
        totalCost: 0,
        storageByType: {
          video: 0,
          image: 0,
          document: 0,
          audio: 0,
          other: 0,
        },
        topStreamingSessions: [],
      };
    }

    // Calculate storage by type breakdown in GB
    const storageByType = {
      video: usageDoc.videoStorageBytes / (1024 * 1024 * 1024),
      image: usageDoc.imageStorageBytes / (1024 * 1024 * 1024),
      document: usageDoc.documentStorageBytes / (1024 * 1024 * 1024),
      audio: 0, // We don't track audio separately yet
      other: usageDoc.otherStorageBytes / (1024 * 1024 * 1024),
    };

    // Get top streaming sessions (last 10 completed sessions)
    const topStreamingSessions = usageDoc.streamingSessions
      .filter((session) => session.endTime)
      .sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime())
      .slice(0, 10)
      .map((session) => ({
        assetId: session.assetId,
        duration: Math.round(session.durationMinutes * 60 * 100) / 100, // Convert minutes to seconds with precision
        bytesTransferred: session.bytesTransferred,
        quality: session.quality,
        createdAt: session.startTime.toISOString(),
      }));

    // Calculate total streaming usage in GB (from bytes transferred)
    const totalStreamingGB =
      (usageDoc.totalBandwidthBytes || 0) / (1024 * 1024 * 1024);

    return {
      period: `${targetMonth}/${targetYear}`,
      totalStorageUsed: usageDoc.totalStorageGB,
      totalStorageLimit: usageDoc.planStorageGB,
      totalStreamingUsed: totalStreamingGB, // Changed to bytes in GB instead of minutes
      totalStreamingLimit: usageDoc.planStreamingMinutes,
      storageOverage: usageDoc.overageStorageGB,
      streamingOverage: usageDoc.overageStreamingMinutes,
      storageCost: usageDoc.overageStorageCost / 100, // Convert cents to dollars
      streamingCost: usageDoc.overageStreamingCost / 100, // Convert cents to dollars
      totalCost:
        (usageDoc.overageStorageCost + usageDoc.overageStreamingCost) / 100,
      storageByType,
      topStreamingSessions,
    };
  }

  /**
   * Get streaming history for a school with date range filter
   */
  async getStreamingHistory(
    schoolId: string,
    startDate?: string,
    endDate?: string,
    limit: number = 50,
  ): Promise<any[]> {
    try {
      const dateFilter: any = {};

      if (startDate || endDate) {
        if (startDate) {
          dateFilter.$gte = new Date(startDate);
        }
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999); // End of day
          dateFilter.$lte = endDateTime;
        }
      }

      // Get usage documents within date range
      const query: any = { school: new Types.ObjectId(schoolId) };
      if (Object.keys(dateFilter).length > 0) {
        query.lastUpdated = dateFilter;
      }

      const usageDocs = await this.usageModel.find(query).exec();

      // Collect all streaming sessions from all months
      const allSessions: any[] = [];

      for (const doc of usageDocs) {
        const sessions = doc.streamingSessions
          .filter((session) => session.endTime) // Only completed sessions
          .filter((session) => {
            if (!startDate && !endDate) return true;
            const sessionDate = session.startTime;
            if (startDate && sessionDate < new Date(startDate)) return false;
            if (endDate && sessionDate > new Date(endDate + 'T23:59:59.999Z'))
              return false;
            return true;
          })
          .map((session) => ({
            sessionId: session.sessionId,
            assetId: session.assetId,
            schoolId,
            userId: session.userId.toString(),
            duration: Math.round(session.durationMinutes * 60 * 100) / 100, // Convert minutes to seconds with precision
            bytesTransferred: session.bytesTransferred,
            quality: session.quality,
            deviceType: session.deviceType,
            startTime: session.startTime.toISOString(),
            endTime: session.endTime?.toISOString(),
            isActive: false,
          }));

        allSessions.push(...sessions);
      }

      // Sort by start time (newest first) and limit
      return allSessions
        .sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Error getting streaming history: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get actual file size from S3
   */
  private async getS3FileSize(s3Key: string): Promise<number> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: s3Key,
      };

      const headResult = await this.s3.headObject(params).promise();
      return headResult.ContentLength || 0;
    } catch (error) {
      this.logger.warn(
        `Error getting S3 file size for ${s3Key}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Finalize monthly usage for billing (called at month end)
   */
  async finalizeMonthlyUsage(month: number, year: number): Promise<void> {
    try {
      const usageDocs = await this.usageModel
        .find({
          month,
          year,
          isFinalized: false,
        })
        .exec();

      for (const doc of usageDocs) {
        // Recalculate all overages one final time
        await this.calculateStorageOverage(doc);
        await this.calculateStreamingOverage(doc);

        doc.isFinalized = true;
        doc.lastUpdated = new Date();
        await doc.save();
      }

      this.logger.log(
        `Finalized ${usageDocs.length} usage documents for ${month}/${year}`,
      );
    } catch (error) {
      this.logger.error(
        `Error finalizing monthly usage for ${month}/${year}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Backfill storage usage with REAL file sizes from S3
   * This gets actual file sizes instead of estimates
   */
  async backfillStorageUsageWithRealSizes(): Promise<{
    processed: number;
    errors: number;
  }> {
    try {
      this.logger.log(
        'Starting backfill of storage usage for existing videos...',
      );

      let processed = 0;
      let errors = 0;

      // Get all classes with videos
      const classes = await this.classModel
        .find({
          videoUrl: { $exists: true, $ne: null },
        })
        .populate({
          path: 'course',
          select: 'school',
          populate: {
            path: 'school',
            select: '_id name',
          },
        })
        .populate('teacher', '_id')
        .exec();

      this.logger.log(`Found ${classes.length} classes with videos to process`);

      for (const classItem of classes) {
        try {
          // Extract school ID from course
          const course = classItem.course as any;
          if (!course || !course.school) {
            this.logger.warn(
              `Class ${classItem._id} has no valid course/school, skipping`,
            );
            errors++;
            continue;
          }

          // Handle populated school object or just ID
          const schoolId =
            typeof course.school === 'string'
              ? course.school
              : course.school._id.toString();
          const teacherId =
            (classItem.teacher as any)?._id?.toString() ||
            classItem.teacher?.toString() ||
            'unknown';
          const uploadDate = classItem.createdAt || new Date();
          const month = uploadDate.getMonth() + 1;
          const year = uploadDate.getFullYear();

          // Extract asset ID from CloudFront or S3 URL
          let assetId;
          try {
            // Handle CloudFront URLs like: https://diqggv7d0nfl3.cloudfront.net/videos/67b84a4c-081a-4534-b2a6-5d7ba77d87bd.mp4
            if (
              classItem.videoUrl.includes('cloudfront.net/videos/') ||
              classItem.videoUrl.includes('amazonaws.com/')
            ) {
              const urlParts = classItem.videoUrl.split('?')[0]; // Remove query params
              const pathMatch = urlParts.match(/videos\/([^\/]+\.mp4)$/);
              if (pathMatch) {
                assetId = pathMatch[1]; // Just the filename with UUID
              } else {
                assetId = `${classItem._id}.mp4`; // Fallback using class ID
              }
            } else {
              assetId = `${classItem._id}.mp4`; // Fallback key
            }
          } catch (error) {
            this.logger.warn(
              `Error parsing video URL for class ${classItem._id}: ${error.message}`,
            );
            assetId = `${classItem._id}.mp4`; // Fallback key
          }

          // Get REAL file size from S3
          let actualSize = 0;
          const fileName = `${classItem.title || 'video'}_${classItem._id}.mp4`;

          try {
            // The correct S3 key includes the videos/ prefix
            const s3Key = `videos/${assetId}`;
            actualSize = await this.getS3FileSize(s3Key);
            this.logger.log(
              `Got real file size for ${s3Key}: ${actualSize} bytes (${(actualSize / 1024 / 1024).toFixed(2)} MB)`,
            );
          } catch (sizeError) {
            this.logger.warn(
              `Could not get real file size for videos/${assetId}, skipping this video: ${sizeError.message}`,
            );
            errors++;
            continue; // Skip videos that don't exist in S3 instead of using estimates
          }

          // Check if usage is already tracked for this asset
          const existingUsage = await this.usageModel
            .findOne({
              school: new Types.ObjectId(schoolId),
              month,
              year,
              'assets.assetId': assetId,
            })
            .exec();

          if (existingUsage) {
            continue;
          }

          // Track the storage usage
          await this.trackStorageUsage({
            assetId,
            assetType: 'video',
            fileSizeBytes: actualSize,
            fileName,
            uploadedBy: teacherId,
            schoolId,
            relatedCourse: course._id.toString(),
            relatedClass: classItem._id.toString(),
          });

          processed++;
        } catch (error) {
          errors++;
          this.logger.error(
            `Error processing class ${classItem._id}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Backfill completed. Processed: ${processed}, Errors: ${errors}`,
      );
      return { processed, errors };
    } catch (error) {
      this.logger.error(`Error during backfill: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Reset storage tracking with corrected file sizes
   * This clears all storage tracking and recalculates with better size estimates
   */
  async resetStorageTracking(): Promise<{ processed: number }> {
    try {
      this.logger.log('Resetting storage tracking with corrected sizes...');

      // Clear all existing storage tracking for the affected school
      await this.usageModel.updateMany(
        { school: new Types.ObjectId('68044f6422ec1bd6922709f4') },
        {
          $set: {
            assets: [],
            totalStorageBytes: 0,
            videoStorageBytes: 0,
            imageStorageBytes: 0,
            documentStorageBytes: 0,
            otherStorageBytes: 0,
            totalStorageGB: 0,
            storageByUser: new Map(),
            overageStorageGB: 0,
            overageStorageCost: 0,
          },
        },
      );

      this.logger.log(
        'Cleared existing storage tracking, running new backfill...',
      );

      // Run backfill with REAL file sizes from S3
      const result = await this.backfillStorageUsageWithRealSizes();

      this.logger.log(`Reset completed. Processed: ${result.processed} videos`);
      return { processed: result.processed };
    } catch (error) {
      this.logger.error(
        `Error during storage reset: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Manually fix storage total for a school with the correct values
   */
  async fixStorageTotal(
    schoolId: string,
    totalBytes: number,
    totalGB: number,
  ): Promise<void> {
    try {
      await this.usageModel.updateMany(
        { school: new Types.ObjectId(schoolId) },
        {
          $set: {
            totalStorageBytes: totalBytes,
            videoStorageBytes: totalBytes, // Assuming all storage is video
            totalStorageGB: totalGB,
          },
        },
      );

      this.logger.log(
        `Updated storage total for school ${schoolId} to ${totalGB.toFixed(3)} GB`,
      );
    } catch (error) {
      this.logger.error(
        `Error fixing storage total: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all schools with overages for billing alerts
   */
  async getSchoolsWithOverages(month?: number, year?: number): Promise<any[]> {
    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    return await this.usageModel
      .find({
        month: targetMonth,
        year: targetYear,
        $or: [
          { overageStorageGB: { $gt: 0 } },
          { overageStreamingMinutes: { $gt: 0 } },
        ],
      })
      .populate('school', 'name')
      .exec();
  }
}
