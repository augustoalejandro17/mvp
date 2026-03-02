import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserPoints,
  UserPointsDocument,
  PointsActionType,
  PointsTransaction,
  LevelInfo,
} from '../schemas/user-points.schema';
import { Level, LevelDocument } from '../schemas/level.schema';
import {
  AwardPointsDto,
  DeductPointsDto,
  UpdateStreakDto,
} from '../dto/points.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { BadgeService } from './badge.service';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectModel(UserPoints.name)
    private userPointsModel: Model<UserPointsDocument>,
    @InjectModel(Level.name)
    private levelModel: Model<LevelDocument>,
    private notificationsService: NotificationsService,
    private badgeService: BadgeService,
  ) {}

  async initializeUserPoints(
    userId: string,
    schoolId: string,
  ): Promise<UserPointsDocument> {
    const existingPoints = await this.userPointsModel
      .findOne({ user: userId, school: schoolId })
      .exec();

    if (existingPoints) {
      return existingPoints;
    }

    const level1 = await this.levelModel
      .findOne({ level: 1, isActive: true })
      .exec();
    const levelInfo: LevelInfo = level1
      ? {
          level: 1,
          name: level1.name,
          minPoints: level1.minPoints,
          maxPoints: level1.maxPoints,
          benefits: level1.benefits.perks,
          badgeUrl: level1.iconUrl,
        }
      : {
          level: 1,
          name: 'Beginner',
          minPoints: 0,
          maxPoints: 100,
          benefits: [],
        };

    const userPoints = (await this.userPointsModel.create({
      user: userId,
      school: schoolId,
      totalPoints: 0,
      availablePoints: 0,
      spentPoints: 0,
      level: 1,
      levelInfo,
      pointsToNextLevel: levelInfo.maxPoints,
      transactions: [],
      coursePoints: new Map(),
      categoryPoints: new Map(),
      streak: 0,
      longestStreak: 0,
      rank: 0,
      schoolRank: 0,
      monthlyStats: {},
      weeklyStats: {},
      achievements: {},
      isLeaderboardVisible: true,
      specialTitles: [],
    })) as UserPointsDocument;

    // Initialize badge progress
    // await this.badgeService.initializeUserBadgeProgress(userId, schoolId);

    return userPoints;
  }

  async awardPoints(awardPointsDto: AwardPointsDto): Promise<{
    userPoints: UserPointsDocument;
    leveledUp: boolean;
    newLevel?: LevelInfo;
    badgesEarned: any[];
  }> {
    const {
      userId,
      schoolId,
      points,
      actionType,
      description,
      courseId,
      classId,
      badgeId,
      metadata,
      sendNotification,
    } = awardPointsDto;

    let userPoints = await this.userPointsModel
      .findOne({ user: userId, school: schoolId })
      .exec();

    if (!userPoints) {
      userPoints = await this.initializeUserPoints(userId, schoolId);
    }

    const transaction: PointsTransaction = {
      points,
      actionType,
      description,
      date: new Date(),
      courseId,
      classId,
      badgeId,
      metadata,
    };

    // Update points
    const oldTotalPoints = userPoints.totalPoints;
    userPoints.totalPoints += points;
    userPoints.availablePoints += points;
    userPoints.transactions.push(transaction);

    // Update course-specific points
    if (courseId) {
      const currentCoursePoints = userPoints.coursePoints.get(courseId) || 0;
      userPoints.coursePoints.set(courseId, currentCoursePoints + points);
    }

    // Update activity tracking
    userPoints.lastActivityDate = new Date();
    this.updateStatistics(userPoints, points);

    // Check for level up
    const { leveledUp, newLevel } = await this.checkLevelUp(userPoints);

    // Update badge progress
    const badgesEarned = await this.badgeService.updateBadgeProgress(
      userId,
      schoolId,
      actionType,
      actionType === PointsActionType.VIDEO_WATCH ? 1 : points,
      courseId,
      classId,
      metadata,
    );

    await userPoints.save();

    // Update rankings
    await this.updateUserRankings(schoolId);

    // Send notifications
    if (sendNotification) {
      await this.sendPointsNotification(
        userId,
        points,
        actionType,
        description,
      );
    }

    if (leveledUp && newLevel) {
      await this.sendLevelUpNotification(userId, newLevel);
    }

    return {
      userPoints,
      leveledUp,
      newLevel,
      badgesEarned,
    };
  }

  async deductPoints(deductPointsDto: DeductPointsDto): Promise<UserPoints> {
    const { userId, schoolId, points, reason, metadata } = deductPointsDto;

    const userPoints = await this.userPointsModel
      .findOne({ user: userId, school: schoolId })
      .exec();

    if (!userPoints) {
      throw new NotFoundException('User points not found');
    }

    if (userPoints.availablePoints < points) {
      throw new BadRequestException('Insufficient points');
    }

    const transaction: PointsTransaction = {
      points: -points,
      actionType: PointsActionType.MANUAL_ADJUSTMENT,
      description: reason,
      date: new Date(),
      metadata,
    };

    userPoints.availablePoints -= points;
    userPoints.spentPoints += points;
    userPoints.transactions.push(transaction);

    await userPoints.save();

    return userPoints;
  }

  async updateStreak(updateStreakDto: UpdateStreakDto): Promise<UserPoints> {
    const { userId, schoolId, streak, resetStreak } = updateStreakDto;

    const userPoints = await this.userPointsModel
      .findOne({ user: userId, school: schoolId })
      .exec();

    if (!userPoints) {
      throw new NotFoundException('User points not found');
    }

    if (resetStreak) {
      userPoints.streak = 0;
    } else {
      userPoints.streak = streak;
      if (streak > userPoints.longestStreak) {
        userPoints.longestStreak = streak;
      }
    }

    userPoints.lastActivityDate = new Date();
    await userPoints.save();

    // Award streak bonuses
    if (streak > 0 && streak % 7 === 0) {
      const bonusPoints = Math.floor(streak / 7) * 10;
      await this.awardPoints({
        userId,
        schoolId,
        points: bonusPoints,
        actionType: PointsActionType.STREAK_BONUS,
        description: `${streak} day streak bonus`,
        metadata: { streakDays: streak },
      });
    }

    return userPoints;
  }

  async getUserPoints(
    userId: string,
    schoolId: string,
  ): Promise<UserPoints | null> {
    let userPoints = await this.userPointsModel
      .findOne({ user: userId, school: schoolId })
      .exec();

    if (!userPoints) {
      // Initialize user points if they don't exist
      userPoints = await this.initializeUserPoints(userId, schoolId);
    }

    return userPoints;
  }

  async findUserPointsRecord(
    userId: string,
  ): Promise<UserPointsDocument | null> {
    return this.userPointsModel.findOne({ user: userId }).exec();
  }

  async getTopUsers(
    schoolId: string,
    limit: number = 10,
  ): Promise<UserPoints[]> {
    return this.userPointsModel
      .find({ school: schoolId, isLeaderboardVisible: true })
      .sort({ totalPoints: -1 })
      .limit(limit)
      .populate('user', 'name email profileImageUrl')
      .exec();
  }

  async getUserRank(
    userId: string,
    schoolId: string,
  ): Promise<{
    schoolRank: number;
    globalRank: number;
    totalInSchool: number;
    totalGlobal: number;
  }> {
    const userPoints = await this.userPointsModel
      .findOne({ user: userId, school: schoolId })
      .exec();

    if (!userPoints) {
      throw new NotFoundException('User points not found');
    }

    const schoolRank =
      (await this.userPointsModel
        .countDocuments({
          school: schoolId,
          totalPoints: { $gt: userPoints.totalPoints },
          isLeaderboardVisible: true,
        })
        .exec()) + 1;

    const globalRank =
      (await this.userPointsModel
        .countDocuments({
          totalPoints: { $gt: userPoints.totalPoints },
          isLeaderboardVisible: true,
        })
        .exec()) + 1;

    const totalInSchool = await this.userPointsModel
      .countDocuments({ school: schoolId, isLeaderboardVisible: true })
      .exec();

    const totalGlobal = await this.userPointsModel
      .countDocuments({ isLeaderboardVisible: true })
      .exec();

    return {
      schoolRank,
      globalRank,
      totalInSchool,
      totalGlobal,
    };
  }

  private async checkLevelUp(userPoints: UserPoints): Promise<{
    leveledUp: boolean;
    newLevel?: LevelInfo;
  }> {
    const nextLevel = await this.levelModel
      .findOne({
        level: userPoints.level + 1,
        isActive: true,
        minPoints: { $lte: userPoints.totalPoints },
      })
      .exec();

    if (!nextLevel) {
      return { leveledUp: false };
    }

    const newLevelInfo: LevelInfo = {
      level: nextLevel.level,
      name: nextLevel.name,
      minPoints: nextLevel.minPoints,
      maxPoints: nextLevel.maxPoints,
      benefits: nextLevel.benefits.perks,
      badgeUrl: nextLevel.iconUrl,
    };

    userPoints.level = nextLevel.level;
    userPoints.levelInfo = newLevelInfo;

    // Calculate points to next level
    const nextLevelUp = await this.levelModel
      .findOne({
        level: nextLevel.level + 1,
        isActive: true,
      })
      .exec();

    userPoints.pointsToNextLevel = nextLevelUp
      ? nextLevelUp.minPoints - userPoints.totalPoints
      : 0;

    // Add level up transaction
    const transaction: PointsTransaction = {
      points: nextLevel.pointsRequired || 0,
      actionType: PointsActionType.LEVEL_UP,
      description: `Level up to ${nextLevel.name}`,
      date: new Date(),
      metadata: { level: nextLevel.level },
    };

    userPoints.transactions.push(transaction);

    return { leveledUp: true, newLevel: newLevelInfo };
  }

  private updateStatistics(userPoints: UserPoints, points: number): void {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    const weekKey = this.getWeekKey(now);

    // Update monthly stats
    if (!userPoints.monthlyStats[monthKey]) {
      userPoints.monthlyStats[monthKey] = { points: 0, activities: 0 };
    }
    userPoints.monthlyStats[monthKey].points += points;
    userPoints.monthlyStats[monthKey].activities += 1;

    // Update weekly stats
    if (!userPoints.weeklyStats[weekKey]) {
      userPoints.weeklyStats[weekKey] = { points: 0, activities: 0 };
    }
    userPoints.weeklyStats[weekKey].points += points;
    userPoints.weeklyStats[weekKey].activities += 1;
  }

  private getWeekKey(date: Date): string {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    return `${startOfWeek.getFullYear()}-W${Math.ceil(startOfWeek.getDate() / 7)}`;
  }

  private async updateUserRankings(schoolId: string): Promise<void> {
    // Update school rankings
    const schoolUsers = await this.userPointsModel
      .find({ school: schoolId, isLeaderboardVisible: true })
      .sort({ totalPoints: -1 })
      .exec();

    for (let i = 0; i < schoolUsers.length; i++) {
      schoolUsers[i].schoolRank = i + 1;
      await schoolUsers[i].save();
    }
  }

  private async sendPointsNotification(
    userId: string,
    points: number,
    actionType: PointsActionType,
    description: string,
  ): Promise<void> {
    try {
      // Create more descriptive and engaging notification messages in Spanish
      let title = '🎯 ¡Puntos Ganados!';
      let message = `Has ganado ${points} puntos por ${description}`;

      // Customize messages based on action type
      switch (actionType) {
        case PointsActionType.VIDEO_WATCH:
          title = '📺 ¡Video Completado!';
          message = `¡Excelente trabajo! Has ganado ${points} puntos por ver un video`;
          break;
        case PointsActionType.CLASS_ATTENDANCE:
          title = '👥 ¡Asistencia a Clase!';
          message = `¡Perfecto! Has ganado ${points} puntos por asistir a clase`;
          break;
        case PointsActionType.ASSIGNMENT_COMPLETION:
          title = '📝 ¡Tarea Completada!';
          message = `¡Excelente! Has ganado ${points} puntos por completar una tarea`;
          break;
        case PointsActionType.QUIZ_COMPLETION:
          title = '🧠 ¡Cuestionario Completado!';
          message = `¡Muy bien! Has ganado ${points} puntos por completar un cuestionario`;
          break;
        case PointsActionType.PARTICIPATION:
          title = '🗣️ ¡Gran Participación!';
          message = `¡Increíble! Has ganado ${points} puntos por participar activamente`;
          break;
        case PointsActionType.STREAK_BONUS:
          title = '🔥 ¡Bonus de Racha!';
          message = `¡Fantástico! Has ganado ${points} puntos por mantener tu racha`;
          break;
        case PointsActionType.TEACHER_REWARD:
          title = '⭐ ¡Reconocimiento del Profesor!';
          message = `¡Felicitaciones! Tu profesor te ha otorgado ${points} puntos`;
          break;
        case PointsActionType.MANUAL_ADJUSTMENT:
          title = '🎁 ¡Puntos Bonus!';
          message = `¡Felicitaciones! Has ganado ${points} puntos: ${description}`;
          break;
        default:
          title = '🎯 ¡Puntos Ganados!';
          message = `Has ganado ${points} puntos por ${description}`;
      }

      await this.notificationsService.create({
        title,
        message,
        type: NotificationType.POINTS_EARNED,
        recipient: userId,
        metadata: {
          points,
          actionType,
          description,
          actionUrl: '/profile?tab=points',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send points notification: ${error.message}`);
    }
  }

  private async sendLevelUpNotification(
    userId: string,
    level: LevelInfo,
  ): Promise<void> {
    try {
      await this.notificationsService.create({
        title: '🎉 ¡Subiste de Nivel!',
        message: `¡Felicitaciones! Has alcanzado el nivel ${level.level}: ${level.name}! Has desbloqueado nuevos beneficios y características.`,
        type: NotificationType.LEVEL_UP,
        recipient: userId,
        metadata: {
          level: level.level,
          levelName: level.name,
          benefits: level.benefits,
          actionUrl: '/profile?tab=level',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send level up notification: ${error.message}`,
      );
    }
  }

  async seedDefaultLevels(): Promise<void> {
    const defaultLevels = [
      {
        level: 1,
        name: 'Beginner',
        minPoints: 0,
        maxPoints: 100,
        pointsRequired: 0,
        benefits: {
          description: 'Welcome to the learning journey!',
          perks: ['Access to basic courses', 'Profile customization'],
          unlockedFeatures: [],
        },
        iconUrl: '/levels/beginner.png',
        color: '#4CAF50',
      },
      {
        level: 2,
        name: 'Student',
        minPoints: 100,
        maxPoints: 250,
        pointsRequired: 100,
        benefits: {
          description: "You're making great progress!",
          perks: ['Bonus points for streaks', 'Access to quizzes'],
          unlockedFeatures: ['quiz_system'],
        },
        iconUrl: '/levels/student.png',
        color: '#2196F3',
      },
      {
        level: 3,
        name: 'Scholar',
        minPoints: 250,
        maxPoints: 500,
        pointsRequired: 250,
        benefits: {
          description: 'Your dedication is showing!',
          perks: ['Priority support', 'Advanced courses access'],
          unlockedFeatures: ['advanced_courses', 'priority_support'],
        },
        iconUrl: '/levels/scholar.png',
        color: '#FF9800',
      },
      {
        level: 4,
        name: 'Expert',
        minPoints: 500,
        maxPoints: 1000,
        pointsRequired: 500,
        benefits: {
          description: "You're becoming an expert!",
          perks: ['Mentor other students', 'Special certificates'],
          unlockedFeatures: ['mentorship', 'certificates'],
        },
        iconUrl: '/levels/expert.png',
        color: '#9C27B0',
      },
      {
        level: 5,
        name: 'Master',
        minPoints: 1000,
        maxPoints: 99999,
        pointsRequired: 1000,
        benefits: {
          description: "You've achieved mastery!",
          perks: ['All features unlocked', 'Exclusive content', 'Recognition'],
          unlockedFeatures: ['all_features', 'exclusive_content'],
        },
        iconUrl: '/levels/master.png',
        color: '#F44336',
      },
    ];

    for (const levelData of defaultLevels) {
      const existingLevel = await this.levelModel
        .findOne({ level: levelData.level })
        .exec();
      if (!existingLevel) {
        await this.levelModel.create(levelData);
      }
    }

    this.logger.log('Default levels seeded successfully');
  }
}
