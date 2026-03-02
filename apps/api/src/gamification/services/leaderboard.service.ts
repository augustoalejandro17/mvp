import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Leaderboard,
  LeaderboardDocument,
  LeaderboardType,
  LeaderboardPeriod,
  LeaderboardEntry,
} from '../schemas/leaderboard.schema';
import { UserPoints, UserPointsDocument } from '../schemas/user-points.schema';
import { User, UserDocument } from '../../auth/schemas/user.schema';
import { GetLeaderboardDto } from '../dto/points.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectModel(Leaderboard.name)
    private leaderboardModel: Model<LeaderboardDocument>,
    @InjectModel(UserPoints.name)
    private userPointsModel: Model<UserPointsDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async getLeaderboard(
    getLeaderboardDto: GetLeaderboardDto,
  ): Promise<LeaderboardEntry[]> {
    const {
      type,
      period,
      schoolId,
      courseId,
      category,
      limit = 10,
      offset = 0,
      includeInactive = false,
    } = getLeaderboardDto;

    // Try to get cached leaderboard first
    const cachedLeaderboard = await this.getCachedLeaderboard(
      type as LeaderboardType,
      period as LeaderboardPeriod,
      {
        schoolId,
        courseId,
        category,
      },
    );

    if (cachedLeaderboard && cachedLeaderboard.entries.length > 0) {
      return cachedLeaderboard.entries.slice(offset, offset + limit);
    }

    // Generate fresh leaderboard
    const entries = await this.generateLeaderboard(
      type as LeaderboardType,
      period as LeaderboardPeriod,
      {
        schoolId,
        courseId,
        category,
        includeInactive,
      },
    );

    // Cache the result
    await this.cacheLeaderboard(
      type as LeaderboardType,
      period as LeaderboardPeriod,
      entries,
      {
        schoolId,
        courseId,
        category,
      },
    );

    return entries.slice(offset, offset + limit);
  }

  async getUserLeaderboardPosition(
    userId: string,
    type: LeaderboardType,
    period: LeaderboardPeriod,
    schoolId?: string,
    courseId?: string,
    category?: string,
  ): Promise<{
    position: number;
    totalParticipants: number;
    userEntry: LeaderboardEntry | null;
  }> {
    const entries = await this.generateLeaderboard(type, period, {
      schoolId,
      courseId,
      category,
      includeInactive: true,
    });

    const userPosition = entries.findIndex((entry) => entry.userId === userId);
    const userEntry = userPosition >= 0 ? entries[userPosition] : null;

    return {
      position: userPosition + 1,
      totalParticipants: entries.length,
      userEntry,
    };
  }

  async getTopPerformers(
    schoolId: string,
    period: LeaderboardPeriod = LeaderboardPeriod.MONTHLY,
    limit: number = 5,
  ): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard({
      type: 'school',
      period,
      schoolId,
      limit,
    });
  }

  async getCourseLeaderboard(
    courseId: string,
    period: LeaderboardPeriod = LeaderboardPeriod.WEEKLY,
    limit: number = 10,
  ): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard({
      type: 'course',
      period,
      courseId,
      limit,
    });
  }

  private async generateLeaderboard(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    filters: {
      schoolId?: string;
      courseId?: string;
      category?: string;
      includeInactive?: boolean;
    },
  ): Promise<LeaderboardEntry[]> {
    const { schoolId, courseId, category, includeInactive = false } = filters;
    const { startDate, endDate } = this.getPeriodRange(period);

    const query: any = {
      isLeaderboardVisible: true,
    };

    if (schoolId && type === LeaderboardType.SCHOOL) {
      query.school = schoolId;
    }

    if (!includeInactive) {
      query.lastActivityDate = {
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      };
    }

    // For period-based queries, we need to calculate points within the period
    let userPoints: UserPointsDocument[];

    if (period === LeaderboardPeriod.ALL_TIME) {
      userPoints = await this.userPointsModel
        .find(query)
        .populate('user', 'name email profileImageUrl')
        .sort({ totalPoints: -1 })
        .exec();
    } else {
      // Calculate points for the specific period
      userPoints = await this.calculatePeriodPoints(query, startDate, endDate);
    }

    // If no users found with points, get first 20 registered users
    if (userPoints.length === 0) {
      this.logger.log(
        'No users found with points, getting first 20 registered users',
      );
      return this.getFirstRegisteredUsers(20);
    }

    const entries: LeaderboardEntry[] = [];

    for (let i = 0; i < userPoints.length; i++) {
      const userPoint = userPoints[i];
      const user = (userPoint as any).user;

      if (!user) continue;

      const entry: LeaderboardEntry = {
        userId: user._id.toString(),
        userName: user.name,
        userAvatar: user.profileImageUrl,
        points:
          period === LeaderboardPeriod.ALL_TIME
            ? userPoint.totalPoints
            : this.getPeriodPoints(userPoint, period),
        level: userPoint.level,
        rank: i + 1,
        previousRank: await this.getPreviousRank(
          user._id.toString(),
          type,
          period,
          filters,
        ),
        badges: await this.getUserBadgeCount(user._id.toString(), schoolId),
        streak: userPoint.streak,
        lastActivity: userPoint.lastActivityDate || new Date(),
        isActive: this.isUserActive(userPoint.lastActivityDate),
        specialTitles: userPoint.specialTitles,
        rankChange: 0, // Will be calculated later
      };

      entries.push(entry);
    }

    // Calculate rank changes
    this.calculateRankChanges(entries);

    return entries;
  }

  private getPeriodRange(period: LeaderboardPeriod): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const endDate = new Date(now);
    let startDate: Date;

    switch (period) {
      case LeaderboardPeriod.DAILY:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case LeaderboardPeriod.WEEKLY:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        break;
      case LeaderboardPeriod.MONTHLY:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case LeaderboardPeriod.YEARLY:
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0); // All time
    }

    return { startDate, endDate };
  }

  private async calculatePeriodPoints(
    query: any,
    startDate: Date,
    endDate: Date,
  ): Promise<UserPointsDocument[]> {
    const userPoints = await this.userPointsModel
      .find(query)
      .populate('user', 'name email profileImageUrl')
      .exec();

    // Calculate points for each user within the period
    const periodUserPoints = userPoints.map((userPoint) => {
      const periodPoints = userPoint.transactions
        .filter(
          (transaction) =>
            transaction.date >= startDate &&
            transaction.date <= endDate &&
            transaction.points > 0,
        )
        .reduce((sum, transaction) => sum + transaction.points, 0);

      return {
        ...userPoint.toObject(),
        totalPoints: periodPoints,
      };
    });

    // Sort by period points
    periodUserPoints.sort((a, b) => b.totalPoints - a.totalPoints);

    return periodUserPoints as UserPointsDocument[];
  }

  private getPeriodPoints(
    userPoint: UserPointsDocument,
    period: LeaderboardPeriod,
  ): number {
    const now = new Date();
    const { startDate } = this.getPeriodRange(period);

    return userPoint.transactions
      .filter(
        (transaction) =>
          transaction.date >= startDate &&
          transaction.date <= now &&
          transaction.points > 0,
      )
      .reduce((sum, transaction) => sum + transaction.points, 0);
  }

  private async getPreviousRank(
    userId: string,
    type: LeaderboardType,
    period: LeaderboardPeriod,
    filters: any,
  ): Promise<number | undefined> {
    // Get previous period's leaderboard
    const previousPeriod = this.getPreviousPeriod(period);
    const cachedLeaderboard = await this.getCachedLeaderboard(
      type,
      previousPeriod,
      filters,
    );

    if (cachedLeaderboard) {
      const entry = cachedLeaderboard.entries.find((e) => e.userId === userId);
      return entry?.rank;
    }

    return undefined;
  }

  private getPreviousPeriod(period: LeaderboardPeriod): LeaderboardPeriod {
    // Return the same period for now - in a real implementation,
    // you'd calculate the previous week/month/year
    return period;
  }

  private async getUserBadgeCount(
    userId: string,
    schoolId?: string,
  ): Promise<number> {
    try {
      // Import the UserAchievement model to count badges
      const { UserAchievement } = await import(
        '../schemas/user-achievement.schema'
      );
      const userAchievementModel =
        this.userPointsModel.db.model('UserAchievement');

      const query: any = {
        user: userId,
        status: 'completed', // Only count completed achievements
      };

      if (schoolId) {
        query.school = schoolId;
      }

      const badgeCount = await userAchievementModel
        .countDocuments(query)
        .exec();
      return badgeCount;
    } catch (error) {
      this.logger.error('Error fetching user badge count:', error);
      return 0;
    }
  }

  private isUserActive(lastActivityDate?: Date): boolean {
    if (!lastActivityDate) return false;
    const daysSinceActivity =
      (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceActivity <= 7; // Active if activity within last 7 days
  }

  private calculateRankChanges(entries: LeaderboardEntry[]): void {
    entries.forEach((entry) => {
      if (entry.previousRank) {
        entry.rankChange = entry.previousRank - entry.rank;
      }
    });
  }

  private async getCachedLeaderboard(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    filters: any,
  ): Promise<Leaderboard | null> {
    const { startDate, endDate } = this.getPeriodRange(period);

    const query: any = {
      type,
      period,
      periodStart: startDate,
      periodEnd: endDate,
      isActive: true,
    };

    // Validate ObjectIds before using them
    if (filters.schoolId && Types.ObjectId.isValid(filters.schoolId)) {
      query.school = filters.schoolId;
    }
    if (filters.courseId && Types.ObjectId.isValid(filters.courseId)) {
      query.course = filters.courseId;
    }
    if (filters.category) {
      query.category = filters.category;
    }

    return this.leaderboardModel.findOne(query).exec();
  }

  private async cacheLeaderboard(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    entries: LeaderboardEntry[],
    filters: any,
  ): Promise<void> {
    const { startDate, endDate } = this.getPeriodRange(period);

    // Validate ObjectIds before using them
    const schoolId =
      filters.schoolId && Types.ObjectId.isValid(filters.schoolId)
        ? filters.schoolId
        : undefined;
    const courseId =
      filters.courseId && Types.ObjectId.isValid(filters.courseId)
        ? filters.courseId
        : undefined;

    const leaderboardData = {
      type,
      period,
      periodStart: startDate,
      periodEnd: endDate,
      school: schoolId,
      course: courseId,
      category: filters.category,
      entries,
      totalParticipants: entries.length,
      lastUpdated: new Date(),
      isActive: true,
    };

    await this.leaderboardModel.findOneAndUpdate(
      {
        type,
        period,
        periodStart: startDate,
        periodEnd: endDate,
        school: schoolId,
        course: courseId,
        category: filters.category,
      },
      leaderboardData,
      { upsert: true, new: true },
    );
  }

  // Scheduled tasks for updating leaderboards
  @Cron(CronExpression.EVERY_HOUR)
  async updateHourlyLeaderboards(): Promise<void> {
    try {
      await this.updateAllLeaderboards(LeaderboardPeriod.DAILY);
    } catch (error) {
      this.logger.error('Error updating hourly leaderboards:', error);
    }
  }

  @Cron('0 0 * * 1') // Every Monday at midnight
  async updateWeeklyLeaderboards(): Promise<void> {
    try {
      await this.updateAllLeaderboards(LeaderboardPeriod.WEEKLY);
    } catch (error) {
      this.logger.error('Error updating weekly leaderboards:', error);
    }
  }

  @Cron('0 0 1 * *') // First day of every month at midnight
  async updateMonthlyLeaderboards(): Promise<void> {
    try {
      await this.updateAllLeaderboards(LeaderboardPeriod.MONTHLY);
    } catch (error) {
      this.logger.error('Error updating monthly leaderboards:', error);
    }
  }

  private async updateAllLeaderboards(
    period: LeaderboardPeriod,
  ): Promise<void> {
    try {
      const schools = await this.userPointsModel.distinct('school').exec();

      for (const schoolId of schools) {
        // Validate school ID
        if (!Types.ObjectId.isValid(schoolId)) {
          this.logger.warn(`Invalid school ID skipped: ${schoolId}`);
          continue;
        }

        // Update school leaderboards
        await this.generateLeaderboard(LeaderboardType.SCHOOL, period, {
          schoolId: schoolId.toString(),
        });

        // Update course leaderboards for this school
        const userPointsWithCourses = await this.userPointsModel
          .find({ school: schoolId })
          .select('coursePoints')
          .exec();

        const courseIds = new Set<string>();

        for (const userPoints of userPointsWithCourses) {
          if (userPoints.coursePoints) {
            for (const courseId of userPoints.coursePoints.keys()) {
              // Only add valid ObjectIds and skip "0", null, undefined
              if (
                courseId &&
                courseId !== '0' &&
                Types.ObjectId.isValid(courseId)
              ) {
                courseIds.add(courseId);
              }
            }
          }
        }

        for (const courseId of courseIds) {
          try {
            await this.generateLeaderboard(LeaderboardType.COURSE, period, {
              courseId,
            });
          } catch (error) {
            this.logger.error(
              `Error updating course leaderboard for course ${courseId}:`,
              error.message,
            );
          }
        }
      }

      // Update global leaderboard
      await this.generateLeaderboard(LeaderboardType.GLOBAL, period, {});

      this.logger.log(`Updated ${period} leaderboards`);
    } catch (error) {
      this.logger.error(
        `Error updating ${period} leaderboards:`,
        error.message,
      );
    }
  }

  private async getFirstRegisteredUsers(
    limit: number = 20,
  ): Promise<LeaderboardEntry[]> {
    try {
      // Get users with their points data
      const usersWithPoints = await this.userPointsModel
        .find({})
        .populate('user', 'name email profileImageUrl createdAt isActive')
        .sort({ totalPoints: -1, createdAt: 1 })
        .limit(limit)
        .exec();

      const entries: LeaderboardEntry[] = [];

      for (let i = 0; i < usersWithPoints.length; i++) {
        const userPoint = usersWithPoints[i];
        const user = (userPoint as any).user;

        if (!user) continue;

        const entry: LeaderboardEntry = {
          userId: user._id.toString(),
          userName: user.name,
          userAvatar: user.profileImageUrl,
          points: userPoint.totalPoints || 0,
          level: userPoint.level || 1,
          rank: i + 1,
          previousRank: undefined,
          badges: 0,
          streak: 0,
          lastActivity: userPoint.lastActivityDate || user.createdAt,
          isActive: user.isActive,
          specialTitles: [],
          rankChange: 0,
        };

        entries.push(entry);
      }

      // If we don't have enough users with points, fill with regular users
      if (entries.length < limit) {
        const existingUserIds = entries.map((e) => e.userId);
        const additionalUsers = await this.userModel
          .find({
            _id: { $nin: existingUserIds },
            isActive: true,
          })
          .sort({ createdAt: 1 })
          .limit(limit - entries.length)
          .exec();

        for (let i = 0; i < additionalUsers.length; i++) {
          const user = additionalUsers[i];

          const entry: LeaderboardEntry = {
            userId: user._id.toString(),
            userName: user.name,
            userAvatar: user.profileImageUrl,
            points: 0,
            level: 1,
            rank: entries.length + i + 1,
            previousRank: undefined,
            badges: 0,
            streak: 0,
            lastActivity: user.createdAt,
            isActive: user.isActive,
            specialTitles: [],
            rankChange: 0,
          };

          entries.push(entry);
        }
      }

      return entries;
    } catch (error) {
      this.logger.error('Error fetching first registered users:', error);
      return [];
    }
  }
}
