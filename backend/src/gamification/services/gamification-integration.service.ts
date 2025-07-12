import { Injectable, Logger } from '@nestjs/common';
import { BadgeService } from './badge.service';
import { PointsService } from './points.service';
import { PointsActionType } from '../schemas/user-points.schema';
import { UserProgressService } from '../../progress/services/user-progress.service';

@Injectable()
export class GamificationIntegrationService {
  private readonly logger = new Logger(GamificationIntegrationService.name);

  constructor(
    private readonly badgeService: BadgeService,
    private readonly pointsService: PointsService,
    private readonly userProgressService: UserProgressService,
  ) {}

  async handleVideoWatched(
    userId: string,
    schoolId: string,
    courseId: string,
    classId: string,
    videoData: {
      duration: number;
      watchedPercentage: number;
      title: string;
    },
  ): Promise<void> {
    try {
      // Update progress tracking first
      await this.userProgressService.updateClassProgress({
        userId,
        classId,
        courseId,
        schoolId,
        videoWatchPercentage: videoData.watchedPercentage,
        timeSpentMinutes: Math.round(videoData.duration / 60),
        metadata: {
          videoTitle: videoData.title,
          lastWatchedAt: new Date(),
        },
      });

      // Award points for watching video
      let points = 5; // Base points
      let shouldNotify = false;
      
      // Bonus points for completion
      if (videoData.watchedPercentage >= 90) {
        points += 5; // Completion bonus
        shouldNotify = true; // Notify for complete video watching
      }
      
      // Bonus points for long videos
      if (videoData.duration > 1800) { // 30 minutes
        points += 3; // Long video bonus
        shouldNotify = true; // Notify for long videos
      }

      await this.pointsService.awardPoints({
        userId,
        schoolId,
        points,
        actionType: PointsActionType.VIDEO_WATCH,
        description: `Watched: ${videoData.title}`,
        courseId,
        classId,
        metadata: {
          duration: videoData.duration,
          watchedPercentage: videoData.watchedPercentage,
          completionBonus: videoData.watchedPercentage >= 90,
          longVideoBonus: videoData.duration > 1800,
        },
        sendNotification: shouldNotify, // Only notify for significant achievements
      });

      // Update badge progress
      await this.badgeService.updateBadgeProgress(
        userId,
        schoolId,
        'video_watch',
        1,
        courseId,
        classId,
        { videoTitle: videoData.title, watchedPercentage: videoData.watchedPercentage },
      );

    } catch (error) {
      this.logger.error(`Error handling video watched: ${error.message}`);
    }
  }

  async handleClassAttendance(
    userId: string,
    schoolId: string,
    courseId: string,
    classId: string,
    attendanceData: {
      attendanceType: 'present' | 'late' | 'absent';
      duration: number;
      participationScore?: number;
    },
  ): Promise<void> {
    try {
      // Update progress tracking first
      await this.userProgressService.updateClassProgress({
        userId,
        classId,
        courseId,
        schoolId,
        attendanceStatus: attendanceData.attendanceType,
        attendanceDate: new Date(),
        metadata: {
          duration: attendanceData.duration,
          participationScore: attendanceData.participationScore,
        },
      });

      if (attendanceData.attendanceType === 'absent') {
        return; // No points for absence
      }

      let points = 10; // Base attendance points
      let shouldNotify = false;
      
      if (attendanceData.attendanceType === 'present') {
        points += 5; // On-time bonus
      }

      // Participation bonus
      if (attendanceData.participationScore && attendanceData.participationScore > 7) {
        points += 10; // High participation bonus
        shouldNotify = true; // Notify for high participation
      }

      await this.pointsService.awardPoints({
        userId,
        schoolId,
        points,
        actionType: PointsActionType.CLASS_ATTENDANCE,
        description: `Class attendance: ${attendanceData.attendanceType}`,
        courseId,
        classId,
        metadata: {
          attendanceType: attendanceData.attendanceType,
          duration: attendanceData.duration,
          participationScore: attendanceData.participationScore,
        },
        sendNotification: shouldNotify, // Only notify for high participation
      });

      // Update badge progress
      await this.badgeService.updateBadgeProgress(
        userId,
        schoolId,
        'class_attendance',
        1,
        courseId,
        classId,
        { attendanceType: attendanceData.attendanceType },
      );

      // Update streak
      await this.updateAttendanceStreak(userId, schoolId);

    } catch (error) {
      this.logger.error(`Error handling class attendance: ${error.message}`);
    }
  }

  async handleAssignmentCompletion(
    userId: string,
    schoolId: string,
    courseId: string,
    assignmentData: {
      title: string;
      score: number;
      maxScore: number;
      submittedOnTime: boolean;
      difficulty: 'easy' | 'medium' | 'hard';
    },
  ): Promise<void> {
    try {
      const percentage = (assignmentData.score / assignmentData.maxScore) * 100;
      
      let points = 15; // Base completion points
      
      // Perfect score bonus
      if (percentage === 100) {
        points += 15;
      } else if (percentage >= 90) {
        points += 10;
      } else if (percentage >= 80) {
        points += 5;
      }

      // On-time submission bonus
      if (assignmentData.submittedOnTime) {
        points += 5;
      }

      // Difficulty bonus
      if (assignmentData.difficulty === 'hard') {
        points += 10;
      } else if (assignmentData.difficulty === 'medium') {
        points += 5;
      }

      await this.pointsService.awardPoints({
        userId,
        schoolId,
        points,
        actionType: PointsActionType.ASSIGNMENT_COMPLETION,
        description: `Completed: ${assignmentData.title}`,
        courseId,
        metadata: {
          score: assignmentData.score,
          maxScore: assignmentData.maxScore,
          percentage,
          submittedOnTime: assignmentData.submittedOnTime,
          difficulty: assignmentData.difficulty,
        },
        sendNotification: true,
      });

      // Update badge progress
      await this.badgeService.updateBadgeProgress(
        userId,
        schoolId,
        'assignment_completion',
        1,
        courseId,
        undefined,
        { score: assignmentData.score, percentage },
      );

    } catch (error) {
      this.logger.error(`Error handling assignment completion: ${error.message}`);
    }
  }

  async handleQuizCompletion(
    userId: string,
    schoolId: string,
    courseId: string,
    quizData: {
      title: string;
      score: number;
      maxScore: number;
      timeSpent: number;
      attempts: number;
    },
  ): Promise<void> {
    try {
      const percentage = (quizData.score / quizData.maxScore) * 100;
      
      let points = 10; // Base quiz points
      
      // Perfect score bonus
      if (percentage === 100) {
        points += 10;
      } else if (percentage >= 90) {
        points += 5;
      }

      // First attempt bonus
      if (quizData.attempts === 1) {
        points += 5;
      }

      // Quick completion bonus (less than 30 seconds per question)
      const questionsEstimate = quizData.maxScore; // Assuming 1 point per question
      if (quizData.timeSpent < questionsEstimate * 30) {
        points += 5;
      }

      await this.pointsService.awardPoints({
        userId,
        schoolId,
        points,
        actionType: PointsActionType.QUIZ_COMPLETION,
        description: `Quiz: ${quizData.title}`,
        courseId,
        metadata: {
          score: quizData.score,
          maxScore: quizData.maxScore,
          percentage,
          timeSpent: quizData.timeSpent,
          attempts: quizData.attempts,
        },
        sendNotification: false,
      });

      // Update badge progress
      await this.badgeService.updateBadgeProgress(
        userId,
        schoolId,
        'quiz_completion',
        1,
        courseId,
        undefined,
        { score: quizData.score, percentage },
      );

    } catch (error) {
      this.logger.error(`Error handling quiz completion: ${error.message}`);
    }
  }

  async handleCourseCompletion(
    userId: string,
    schoolId: string,
    courseId: string,
    courseData: {
      title: string;
      totalClasses: number;
      attendedClasses: number;
      averageScore: number;
      certificateEarned: boolean;
    },
  ): Promise<void> {
    try {
      const completionPercentage = (courseData.attendedClasses / courseData.totalClasses) * 100;
      
      let points = 100; // Base course completion points
      
      // Perfect attendance bonus
      if (completionPercentage === 100) {
        points += 50;
      } else if (completionPercentage >= 90) {
        points += 25;
      }

      // High performance bonus
      if (courseData.averageScore >= 90) {
        points += 50;
      } else if (courseData.averageScore >= 80) {
        points += 25;
      }

      // Certificate bonus
      if (courseData.certificateEarned) {
        points += 25;
      }

      await this.pointsService.awardPoints({
        userId,
        schoolId,
        points,
        actionType: PointsActionType.ASSIGNMENT_COMPLETION, // Using assignment completion for course completion
        description: `Course completed: ${courseData.title}`,
        courseId,
        metadata: {
          totalClasses: courseData.totalClasses,
          attendedClasses: courseData.attendedClasses,
          completionPercentage,
          averageScore: courseData.averageScore,
          certificateEarned: courseData.certificateEarned,
        },
        sendNotification: true,
      });

      // Update badge progress
      await this.badgeService.updateBadgeProgress(
        userId,
        schoolId,
        'course_completion',
        1,
        courseId,
        undefined,
        { 
          completionPercentage,
          averageScore: courseData.averageScore,
          certificateEarned: courseData.certificateEarned,
        },
      );

    } catch (error) {
      this.logger.error(`Error handling course completion: ${error.message}`);
    }
  }

  async handleParticipation(
    userId: string,
    schoolId: string,
    courseId: string,
    classId: string,
    participationData: {
      type: 'question' | 'answer' | 'discussion' | 'help_others';
      description: string;
      quality: 'low' | 'medium' | 'high';
    },
  ): Promise<void> {
    try {
      let points = 3; // Base participation points
      let shouldNotify = false;
      
      // Type bonuses
      if (participationData.type === 'help_others') {
        points += 7; // Helping others is valuable
        shouldNotify = true; // Always notify for helping others
      } else if (participationData.type === 'question') {
        points += 2; // Asking questions is good
      } else if (participationData.type === 'answer') {
        points += 4; // Answering questions is better
      }

      // Quality bonus
      if (participationData.quality === 'high') {
        points += 5;
        shouldNotify = true; // Notify for high quality participation
      } else if (participationData.quality === 'medium') {
        points += 2;
      }

      await this.pointsService.awardPoints({
        userId,
        schoolId,
        points,
        actionType: PointsActionType.PARTICIPATION,
        description: participationData.description,
        courseId,
        classId,
        metadata: {
          type: participationData.type,
          quality: participationData.quality,
        },
        sendNotification: shouldNotify, // Notify for helping others or high quality
      });

      // Update badge progress
      await this.badgeService.updateBadgeProgress(
        userId,
        schoolId,
        'participation',
        1,
        courseId,
        classId,
        { type: participationData.type, quality: participationData.quality },
      );

    } catch (error) {
      this.logger.error(`Error handling participation: ${error.message}`);
    }
  }

  private async updateAttendanceStreak(userId: string, schoolId: string): Promise<void> {
    try {
      const userPoints = await this.pointsService.getUserPoints(userId, schoolId);
      if (!userPoints) return;

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Check if user had attendance yesterday
      const hadAttendanceYesterday = userPoints.transactions.some(
        transaction => 
          transaction.actionType === PointsActionType.CLASS_ATTENDANCE &&
          transaction.date >= yesterday &&
          transaction.date < today
      );

      if (hadAttendanceYesterday) {
        // Continue streak
        await this.pointsService.updateStreak({
          userId,
          schoolId,
          streak: userPoints.streak + 1,
        });
      } else {
        // Start new streak
        await this.pointsService.updateStreak({
          userId,
          schoolId,
          streak: 1,
        });
      }
    } catch (error) {
      this.logger.error(`Error updating attendance streak: ${error.message}`);
    }
  }

  async initializeNewUserGamification(
    userId: string,
    schoolId: string,
    courseId?: string,
  ): Promise<void> {
    try {
      // Initialize user points
      await this.pointsService.initializeUserPoints(userId, schoolId);

      // Initialize badge progress
      await this.badgeService.initializeUserBadgeProgress(userId, schoolId, courseId);

      // Award welcome points
      await this.pointsService.awardPoints({
        userId,
        schoolId,
        points: 10,
        actionType: PointsActionType.MANUAL_ADJUSTMENT,
        description: 'Welcome to the platform!',
        metadata: { welcomeBonus: true },
        sendNotification: true,
      });

    } catch (error) {
      this.logger.error(`Error initializing new user gamification: ${error.message}`);
    }
  }

  async handleDailyLogin(
    userId: string,
    schoolId: string,
  ): Promise<void> {
    try {
      // Check if user already got daily login points today
      const userPoints = await this.pointsService.getUserPoints(userId, schoolId);
      if (!userPoints) {
        // Initialize user points if they don't exist
        await this.pointsService.initializeUserPoints(userId, schoolId);
      }

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Check if user already got daily login points today
      const hasLoginToday = userPoints?.transactions.some(
        transaction => 
          transaction.actionType === PointsActionType.STREAK_BONUS &&
          transaction.description?.includes('Daily login') &&
          transaction.date >= startOfDay &&
          transaction.date < endOfDay
      );

      if (hasLoginToday) {
        return; // Already awarded today
      }

      // Calculate login streak
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1);

      const hadLoginYesterday = userPoints?.transactions.some(
        transaction => 
          transaction.actionType === PointsActionType.STREAK_BONUS &&
          transaction.description?.includes('Daily login') &&
          transaction.date >= startOfYesterday &&
          transaction.date < endOfYesterday
      );

      let currentStreak = 1;
      if (hadLoginYesterday && userPoints) {
        // Continue streak
        currentStreak = (userPoints.streak || 0) + 1;
      }

      // Award daily login points
      let points = 5; // Base daily login points
      
      // Streak bonuses
      if (currentStreak >= 7) {
        points += 10; // Weekly streak bonus
      } else if (currentStreak >= 3) {
        points += 5; // 3-day streak bonus
      }

      await this.pointsService.awardPoints({
        userId,
        schoolId,
        points,
        actionType: PointsActionType.STREAK_BONUS,
        description: `Daily login streak: ${currentStreak} days`,
        metadata: {
          loginStreak: currentStreak,
          dailyLogin: true,
        },
        sendNotification: currentStreak >= 3, // Notify for 3+ day streaks
      });

      // Update user streak
      await this.pointsService.updateStreak({
        userId,
        schoolId,
        streak: currentStreak,
      });

      // Update badge progress
      await this.badgeService.updateBadgeProgress(
        userId,
        schoolId,
        'daily_login',
        1,
        undefined,
        undefined,
        { streak: currentStreak },
      );

    } catch (error) {
      this.logger.error(`Error handling daily login: ${error.message}`);
    }
  }
} 