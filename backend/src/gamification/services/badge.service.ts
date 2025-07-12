import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Badge, BadgeDocument, BadgeType } from '../schemas/badge.schema';
import { 
  UserAchievement, 
  UserAchievementDocument, 
  AchievementStatus,
  ProgressData 
} from '../schemas/user-achievement.schema';
import { CreateBadgeDto, UpdateBadgeDto } from '../dto/create-badge.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  constructor(
    @InjectModel(Badge.name)
    private badgeModel: Model<BadgeDocument>,
    @InjectModel(UserAchievement.name)
    private userAchievementModel: Model<UserAchievementDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async createBadge(createBadgeDto: CreateBadgeDto): Promise<Badge> {
    const badge = new this.badgeModel(createBadgeDto);
    return badge.save();
  }

  async getAllBadges(includeInactive: boolean = false): Promise<Badge[]> {
    const query = includeInactive ? {} : { isActive: true };
    return this.badgeModel.find(query).sort({ sortOrder: 1, createdAt: 1 }).exec();
  }

  async getBadgeById(id: string): Promise<Badge> {
    const badge = await this.badgeModel.findById(id).exec();
    if (!badge) {
      throw new NotFoundException(`Badge with ID ${id} not found`);
    }
    return badge;
  }

  async updateBadge(id: string, updateBadgeDto: UpdateBadgeDto): Promise<Badge> {
    const badge = await this.badgeModel
      .findByIdAndUpdate(id, updateBadgeDto, { new: true })
      .exec();
    if (!badge) {
      throw new NotFoundException(`Badge with ID ${id} not found`);
    }
    return badge;
  }

  async deleteBadge(id: string): Promise<void> {
    const result = await this.badgeModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Badge with ID ${id} not found`);
    }
  }

  async getBadgesByType(type: BadgeType): Promise<Badge[]> {
    return this.badgeModel.find({ type, isActive: true }).sort({ sortOrder: 1 }).exec();
  }

  async initializeUserBadgeProgress(
    userId: string,
    schoolId: string,
    courseId?: string,
  ): Promise<void> {
    const badges = await this.getAllBadges();
    
    for (const badge of badges) {
             const existingProgress = await this.userAchievementModel
         .findOne({
           user: userId,
           badge: (badge as any)._id,
           school: schoolId,
         })
         .exec();

      if (!existingProgress) {
        const progress: ProgressData = {
          current: 0,
          required: badge.requirements.value,
          percentage: 0,
          lastUpdated: new Date(),
        };

                 await this.userAchievementModel.create({
           user: userId,
           badge: (badge as any)._id,
           school: schoolId,
           course: courseId,
           status: AchievementStatus.IN_PROGRESS,
           progress,
           pointsEarned: 0,
           metadata: {},
         });
      }
    }
  }

  async updateBadgeProgress(
    userId: string,
    schoolId: string,
    actionType: string,
    value: number,
    courseId?: string,
    classId?: string,
    metadata?: Record<string, any>,
  ): Promise<UserAchievement[]> {
    const relevantBadges = await this.badgeModel
      .find({
        'requirements.type': actionType,
        isActive: true,
        $or: [
          { validFrom: { $exists: false } },
          { validFrom: { $lte: new Date() } },
        ],
        $and: [
          {
            $or: [
              { validUntil: { $exists: false } },
              { validUntil: { $gte: new Date() } },
            ],
          },
        ],
      })
      .exec();

    const completedAchievements: UserAchievement[] = [];

    for (const badge of relevantBadges) {
      const achievement = await this.userAchievementModel
        .findOne({
          user: userId,
          badge: badge._id,
          school: schoolId,
          status: AchievementStatus.IN_PROGRESS,
        })
        .exec();

      if (achievement) {
        achievement.progress.current += value;
        achievement.progress.percentage = Math.min(
          (achievement.progress.current / achievement.progress.required) * 100,
          100,
        );
        achievement.progress.lastUpdated = new Date();
        achievement.metadata = { ...achievement.metadata, ...metadata };

        if (achievement.progress.current >= achievement.progress.required) {
          achievement.status = AchievementStatus.COMPLETED;
          achievement.completedAt = new Date();
          achievement.pointsEarned = badge.pointsReward;
          
          completedAchievements.push(achievement);
          
          // Send notification
          await this.sendBadgeNotification(userId, badge);
        }

        await achievement.save();
      }
    }

    return completedAchievements;
  }

  async getUserBadges(
    userId: string,
    schoolId: string,
    status?: AchievementStatus,
  ): Promise<UserAchievement[]> {
    const query: any = { user: userId, school: schoolId };
    if (status) {
      query.status = status;
    }

    return this.userAchievementModel
      .find(query)
      .populate('badge')
      .populate('course', 'title')
      .sort({ completedAt: -1, createdAt: -1 })
      .exec();
  }

  async getUserBadgeStats(
    userId: string,
    schoolId: string,
  ): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    totalPoints: number;
    completionRate: number;
  }> {
    const achievements = await this.userAchievementModel
      .find({ user: userId, school: schoolId })
      .exec();

    const completed = achievements.filter(a => a.status === AchievementStatus.COMPLETED);
    const inProgress = achievements.filter(a => a.status === AchievementStatus.IN_PROGRESS);
    const totalPoints = completed.reduce((sum, a) => sum + a.pointsEarned, 0);

    return {
      total: achievements.length,
      completed: completed.length,
      inProgress: inProgress.length,
      totalPoints,
      completionRate: achievements.length > 0 ? (completed.length / achievements.length) * 100 : 0,
    };
  }

  async getSchoolBadgeLeaderboard(
    schoolId: string,
    limit: number = 10,
  ): Promise<Array<{
    userId: string;
    userName: string;
    badgeCount: number;
    totalPoints: number;
    recentBadges: UserAchievement[];
  }>> {
    const pipeline = [
      {
        $match: {
          school: new Types.ObjectId(schoolId),
          status: AchievementStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: '$user',
          badgeCount: { $sum: 1 },
          totalPoints: { $sum: '$pointsEarned' },
          recentBadges: {
            $push: {
              $cond: {
                if: { $gte: ['$completedAt', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                then: '$$ROOT',
                else: null,
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
             {
         $sort: { badgeCount: -1 as const, totalPoints: -1 as const },
       },
      {
        $limit: limit,
      },
    ];

    const results = await this.userAchievementModel.aggregate(pipeline).exec();
    
    return results.map(result => ({
      userId: result._id.toString(),
      userName: result.user[0]?.name || 'Unknown',
      badgeCount: result.badgeCount,
      totalPoints: result.totalPoints,
      recentBadges: result.recentBadges.filter(badge => badge !== null),
    }));
  }

  async manualAwardBadge(
    userId: string,
    badgeId: string,
    schoolId: string,
    teacherId: string,
    comment?: string,
  ): Promise<UserAchievement> {
    const badge = await this.getBadgeById(badgeId);
    
    let achievement = await this.userAchievementModel
      .findOne({
        user: userId,
        badge: badgeId,
        school: schoolId,
      })
      .exec();

    if (!achievement) {
      const progress: ProgressData = {
        current: badge.requirements.value,
        required: badge.requirements.value,
        percentage: 100,
        lastUpdated: new Date(),
      };

      achievement = await this.userAchievementModel.create({
        user: userId,
        badge: badgeId,
        school: schoolId,
        status: AchievementStatus.COMPLETED,
        progress,
        completedAt: new Date(),
        pointsEarned: badge.pointsReward,
        teacherComment: comment,
        teacherApprovedAt: new Date(),
        teacherApprovedBy: teacherId,
        metadata: { manualAward: true },
      });
    } else if (achievement.status !== AchievementStatus.COMPLETED) {
      achievement.status = AchievementStatus.COMPLETED;
      achievement.completedAt = new Date();
      achievement.pointsEarned = badge.pointsReward;
      achievement.teacherComment = comment;
      achievement.teacherApprovedAt = new Date();
      achievement.teacherApprovedBy = new Types.ObjectId(teacherId) as any;
      achievement.progress.current = badge.requirements.value;
      achievement.progress.percentage = 100;
      achievement.progress.lastUpdated = new Date();
      achievement.metadata = { ...achievement.metadata, manualAward: true };
      
      await achievement.save();
    }

    // Send notification
    await this.sendBadgeNotification(userId, badge);

    return achievement;
  }

  private async sendBadgeNotification(userId: string, badge: Badge): Promise<void> {
    try {
      await this.notificationsService.create({
        title: '🏆 ¡Insignia Desbloqueada!',
        message: `¡Felicitaciones! Has ganado la insignia "${badge.name}" y recibido ${badge.pointsReward} puntos!`,
        type: NotificationType.BADGE_EARNED,
        recipient: userId,
        metadata: {
          badgeId: (badge as any)._id,
          badgeName: badge.name,
          pointsEarned: badge.pointsReward,
          badgeIcon: badge.iconUrl,
          actionUrl: `/profile?tab=badges`,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send badge notification: ${error.message}`);
    }
  }

  async getBadgeProgress(
    userId: string,
    badgeId: string,
    schoolId: string,
  ): Promise<UserAchievement | null> {
    return this.userAchievementModel
      .findOne({
        user: userId,
        badge: badgeId,
        school: schoolId,
      })
      .populate('badge')
      .exec();
  }

  async seedDefaultBadges(): Promise<void> {
    const defaultBadges = [
      {
        name: 'First Steps',
        description: 'Complete your first video lesson',
        iconUrl: '/badges/first-steps.png',
        type: BadgeType.VIDEO_WATCHING,
        pointsRequired: 0,
        pointsReward: 10,
        requirements: { type: 'video_watch', value: 1, description: 'Watch 1 video' },
        color: '#4CAF50',
      },
      {
        name: 'Video Enthusiast',
        description: 'Watch 10 video lessons',
        iconUrl: '/badges/video-enthusiast.png',
        type: BadgeType.VIDEO_WATCHING,
        pointsRequired: 50,
        pointsReward: 50,
        requirements: { type: 'video_watch', value: 10, description: 'Watch 10 videos' },
        color: '#2196F3',
      },
      {
        name: 'Perfect Attendance',
        description: 'Attend 5 consecutive classes',
        iconUrl: '/badges/perfect-attendance.png',
        type: BadgeType.ATTENDANCE,
        pointsRequired: 100,
        pointsReward: 100,
        requirements: { type: 'class_attendance', value: 5, description: 'Attend 5 classes in a row' },
        color: '#FF9800',
      },
      {
        name: 'Engagement Champion',
        description: 'Participate actively in 20 classes',
        iconUrl: '/badges/engagement-champion.png',
        type: BadgeType.ENGAGEMENT,
        pointsRequired: 200,
        pointsReward: 200,
        requirements: { type: 'participation', value: 20, description: 'Participate in 20 classes' },
        color: '#9C27B0',
      },
    ];

    for (const badgeData of defaultBadges) {
      const existingBadge = await this.badgeModel.findOne({ name: badgeData.name }).exec();
      if (!existingBadge) {
        await this.badgeModel.create(badgeData);
      }
    }

    this.logger.log('Default badges seeded successfully');
  }
} 