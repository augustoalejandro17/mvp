import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsageTracking, UsageTrackingDocument, AssetUsage, StreamingSession } from './schemas/usage-tracking.schema';
import { User } from '../auth/schemas/user.schema';
import { School } from '../schools/schemas/school.schema';
import { Course } from '../courses/schemas/course.schema';
import { Class } from '../classes/schemas/class.schema';
import { Plan } from '../plans/schemas/plan.schema';
import { Subscription } from '../plans/schemas/subscription.schema';

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

  constructor(
    @InjectModel(UsageTracking.name) private usageModel: Model<UsageTrackingDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
  ) {}

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
      let usageDoc = await this.usageModel.findOne({
        school: new Types.ObjectId(options.schoolId),
        month,
        year
      }).exec();

      if (!usageDoc) {
        usageDoc = await this.createNewUsageDocument(options.schoolId, month, year) as any;
      }

      // Create asset usage record
      const assetUsage: AssetUsage = {
        assetId: options.assetId,
        assetType: options.assetType,
        fileSizeBytes: options.fileSizeBytes,
        fileName: options.fileName,
        uploadedBy: new Types.ObjectId(options.uploadedBy),
        uploadedAt: currentDate,
        relatedCourse: options.relatedCourse ? new Types.ObjectId(options.relatedCourse) : undefined,
        relatedClass: options.relatedClass ? new Types.ObjectId(options.relatedClass) : undefined,
        isActive: true
      };

      // Add to assets array
      usageDoc.assets.push(assetUsage);

      // Update totals
      usageDoc.totalStorageBytes += options.fileSizeBytes;
      usageDoc.totalStorageGB = usageDoc.totalStorageBytes / (1024 * 1024 * 1024);

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
      const currentUserUsage = usageDoc.storageByUser.get(options.uploadedBy) || 0;
      usageDoc.storageByUser.set(options.uploadedBy, currentUserUsage + options.fileSizeBytes);

      // Calculate overages
      await this.calculateStorageOverage(usageDoc);

      usageDoc.lastUpdated = currentDate;
      await usageDoc.save();

      this.logger.log(`Storage usage tracked: ${options.fileName} (${options.fileSizeBytes} bytes) for school ${options.schoolId}`);
    } catch (error) {
      this.logger.error(`Error tracking storage usage: ${error.message}`, error.stack);
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

      const usageDoc = await this.usageModel.findOne({
        school: new Types.ObjectId(schoolId),
        month,
        year
      }).exec();

      if (!usageDoc) {
        this.logger.warn(`No usage document found for school ${schoolId} in ${month}/${year}`);
        return;
      }

      // Find and remove the asset
      const assetIndex = usageDoc.assets.findIndex(asset => asset.assetId === assetId && asset.isActive);
      if (assetIndex === -1) {
        this.logger.warn(`Asset ${assetId} not found in usage tracking for school ${schoolId}`);
        return;
      }

      const asset = usageDoc.assets[assetIndex];
      
      // Mark as inactive (soft delete for audit trail)
      asset.isActive = false;

      // Update totals
      usageDoc.totalStorageBytes -= asset.fileSizeBytes;
      usageDoc.totalStorageGB = Math.max(0, usageDoc.totalStorageBytes / (1024 * 1024 * 1024));

      // Update breakdown by type
      switch (asset.assetType) {
        case 'video':
          usageDoc.videoStorageBytes = Math.max(0, usageDoc.videoStorageBytes - asset.fileSizeBytes);
          break;
        case 'image':
          usageDoc.imageStorageBytes = Math.max(0, usageDoc.imageStorageBytes - asset.fileSizeBytes);
          break;
        case 'document':
          usageDoc.documentStorageBytes = Math.max(0, usageDoc.documentStorageBytes - asset.fileSizeBytes);
          break;
        default:
          usageDoc.otherStorageBytes = Math.max(0, usageDoc.otherStorageBytes - asset.fileSizeBytes);
      }

      // Update user attribution
      const userId = asset.uploadedBy.toString();
      const currentUserUsage = usageDoc.storageByUser.get(userId) || 0;
      usageDoc.storageByUser.set(userId, Math.max(0, currentUserUsage - asset.fileSizeBytes));

      // Recalculate overages
      await this.calculateStorageOverage(usageDoc);

      usageDoc.lastUpdated = currentDate;
      await usageDoc.save();

      this.logger.log(`Storage usage removed: ${assetId} for school ${schoolId}`);
    } catch (error) {
      this.logger.error(`Error removing storage usage: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ========================================
  // STREAMING TRACKING
  // ========================================

  /**
   * Start tracking a streaming session
   */
  async startStreamingSession(options: StreamingTrackingOptions): Promise<void> {
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      // Get or create usage document
      let usageDoc = await this.usageModel.findOne({
        school: new Types.ObjectId(options.schoolId),
        month,
        year
      }).exec();

      if (!usageDoc) {
        usageDoc = await this.createNewUsageDocument(options.schoolId, month, year) as any;
      }

      // Create streaming session record
      const streamingSession: StreamingSession = {
        sessionId: options.sessionId,
        userId: new Types.ObjectId(options.userId),
        assetId: options.assetId,
        startTime: currentDate,
        durationMinutes: 0,
        bytesTransferred: 0,
        relatedCourse: options.relatedCourse ? new Types.ObjectId(options.relatedCourse) : undefined,
        relatedClass: options.relatedClass ? new Types.ObjectId(options.relatedClass) : undefined,
        quality: options.quality || 'unknown',
        deviceType: options.deviceType || 'unknown'
      };

      usageDoc.streamingSessions.push(streamingSession);
      usageDoc.lastUpdated = currentDate;
      await usageDoc.save();

      this.logger.log(`Streaming session started: ${options.sessionId} for user ${options.userId}`);
    } catch (error) {
      this.logger.error(`Error starting streaming session: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * End a streaming session and calculate usage
   */
  async endStreamingSession(
    schoolId: string,
    sessionId: string,
    bytesTransferred?: number
  ): Promise<void> {
    try {
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const usageDoc = await this.usageModel.findOne({
        school: new Types.ObjectId(schoolId),
        month,
        year
      }).exec();

      if (!usageDoc) {
        this.logger.warn(`No usage document found for school ${schoolId} when ending session ${sessionId}`);
        return;
      }

      // Find the streaming session
      const session = usageDoc.streamingSessions.find(s => s.sessionId === sessionId && !s.endTime);
      if (!session) {
        this.logger.warn(`Active streaming session ${sessionId} not found for school ${schoolId}`);
        return;
      }

      // Calculate duration
      session.endTime = currentDate;
      session.durationMinutes = Math.round((currentDate.getTime() - session.startTime.getTime()) / 60000);
      session.bytesTransferred = bytesTransferred || 0;

      // Update totals
      usageDoc.totalStreamingMinutes += session.durationMinutes;
      usageDoc.totalBandwidthBytes += session.bytesTransferred;
      usageDoc.totalSessions += 1;

      // Update user attribution
      const userId = session.userId.toString();
      const currentUserUsage = usageDoc.streamingByUser.get(userId) || 0;
      usageDoc.streamingByUser.set(userId, currentUserUsage + session.durationMinutes);

      // Update unique viewers count
      const uniqueUserIds = new Set(
        usageDoc.streamingSessions
          .filter(s => s.endTime) // Only completed sessions
          .map(s => s.userId.toString())
      );
      usageDoc.uniqueViewers = uniqueUserIds.size;

      // Calculate average session duration
      const completedSessions = usageDoc.streamingSessions.filter(s => s.endTime);
      const totalMinutes = completedSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
      usageDoc.averageSessionMinutes = completedSessions.length > 0 ? 
        Math.round(totalMinutes / completedSessions.length) : 0;

      // Calculate streaming overages
      await this.calculateStreamingOverage(usageDoc);

      usageDoc.lastUpdated = currentDate;
      await usageDoc.save();

      this.logger.log(`Streaming session ended: ${sessionId} (${session.durationMinutes} minutes)`);
    } catch (error) {
      this.logger.error(`Error ending streaming session: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ========================================
  // BILLING AND OVERAGE CALCULATIONS
  // ========================================

  private async calculateStorageOverage(usageDoc: UsageTrackingDocument): Promise<void> {
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
      const extraStorageGB = subscription.approvedExtraResources?.extraStorageGb || 0;
      const totalAllowedGB = planStorageGB + extraStorageGB;

      usageDoc.planStorageGB = totalAllowedGB;
      usageDoc.overageStorageGB = Math.max(0, usageDoc.totalStorageGB - totalAllowedGB);

      // Calculate overage cost
      const overageRate = plan.overageStorageCentsPerGB || plan.extraStorageGbPrice * 100 || 20; // Default $0.20/GB
      usageDoc.overageStorageCost = Math.round(usageDoc.overageStorageGB * overageRate);
    } catch (error) {
      this.logger.error('Error calculating storage overage:', error);
    }
  }

  private async calculateStreamingOverage(usageDoc: UsageTrackingDocument): Promise<void> {
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
      const planStreamingMinutes = (plan.streamingHoursPerMonth || 0) * 60 || plan.maxStreamingMinutesPerMonth || 0;
      const extraStreamingMinutes = subscription.approvedExtraResources?.extraStreamingMinutes || 0;
      const totalAllowedMinutes = planStreamingMinutes + extraStreamingMinutes;

      usageDoc.planStreamingMinutes = totalAllowedMinutes;
      usageDoc.overageStreamingMinutes = Math.max(0, usageDoc.totalStreamingMinutes - totalAllowedMinutes);

      // Calculate overage cost (convert hour rate to minute rate)
      const overageRatePerHour = plan.overageStreamingCentsPerHour || 6; // Default $0.06/hour
      const overageRatePerMinute = overageRatePerHour / 60;
      usageDoc.overageStreamingCost = Math.round(usageDoc.overageStreamingMinutes * overageRatePerMinute);
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
    year: number
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
      streamingByUser: new Map()
    });

    const savedDoc = await newUsageDoc.save();
    return savedDoc as UsageTrackingDocument & { _id: any };
  }

  /**
   * Get usage summary for a school in a specific month
   */
  async getUsageSummary(schoolId: string, month?: number, year?: number): Promise<UsageSummary> {
    const currentDate = new Date();
    const targetMonth = month || currentDate.getMonth() + 1;
    const targetYear = year || currentDate.getFullYear();

    const usageDoc = await this.usageModel.findOne({
      school: new Types.ObjectId(schoolId),
      month: targetMonth,
      year: targetYear
    }).exec();

    if (!usageDoc) {
      // Return empty usage if no document exists
      const subscription = await this.subscriptionModel
        .findOne({ school: new Types.ObjectId(schoolId) })
        .populate('plan')
        .exec();

      const plan = subscription?.plan as any;
      const planStorageGB = plan?.storageGB || plan?.maxStorageGb || 0;
      const planStreamingMinutes = ((plan?.streamingHoursPerMonth || 0) * 60) || plan?.maxStreamingMinutesPerMonth || 0;

      return {
        storageGB: 0,
        streamingMinutes: 0,
        overageStorageGB: 0,
        overageStreamingMinutes: 0,
        overageStorageCost: 0,
        overageStreamingCost: 0,
        totalOverageCost: 0,
        planLimits: {
          storageGB: planStorageGB,
          streamingMinutes: planStreamingMinutes
        }
      };
    }

    return {
      storageGB: usageDoc.totalStorageGB,
      streamingMinutes: usageDoc.totalStreamingMinutes,
      overageStorageGB: usageDoc.overageStorageGB,
      overageStreamingMinutes: usageDoc.overageStreamingMinutes,
      overageStorageCost: usageDoc.overageStorageCost,
      overageStreamingCost: usageDoc.overageStreamingCost,
      totalOverageCost: usageDoc.overageStorageCost + usageDoc.overageStreamingCost,
      planLimits: {
        storageGB: usageDoc.planStorageGB,
        streamingMinutes: usageDoc.planStreamingMinutes
      }
    };
  }

  /**
   * Finalize monthly usage for billing (called at month end)
   */
  async finalizeMonthlyUsage(month: number, year: number): Promise<void> {
    try {
      const usageDocs = await this.usageModel.find({
        month,
        year,
        isFinalized: false
      }).exec();

      for (const doc of usageDocs) {
        // Recalculate all overages one final time
        await this.calculateStorageOverage(doc);
        await this.calculateStreamingOverage(doc);
        
        doc.isFinalized = true;
        doc.lastUpdated = new Date();
        await doc.save();
      }

      this.logger.log(`Finalized ${usageDocs.length} usage documents for ${month}/${year}`);
    } catch (error) {
      this.logger.error(`Error finalizing monthly usage for ${month}/${year}: ${error.message}`, error.stack);
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

    return await this.usageModel.find({
      month: targetMonth,
      year: targetYear,
      $or: [
        { overageStorageGB: { $gt: 0 } },
        { overageStreamingMinutes: { $gt: 0 } }
      ]
    }).populate('school', 'name').exec();
  }
} 