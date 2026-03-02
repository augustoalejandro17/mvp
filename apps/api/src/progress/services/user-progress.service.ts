import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  UserClassProgress,
  UserClassProgressDocument,
} from '../schemas/user-class-progress.schema';
import {
  UserCourseProgress,
  UserCourseProgressDocument,
} from '../schemas/user-course-progress.schema';
import { Class, ClassDocument } from '../../classes/schemas/class.schema';
import { Course, CourseDocument } from '../../courses/schemas/course.schema';
import {
  Playlist,
  PlaylistDocument,
} from '../../classes/schemas/playlist.schema';

export interface ProgressUpdateData {
  userId: string;
  classId: string;
  courseId: string;
  schoolId: string;
  videoWatchPercentage?: number;
  timeSpentMinutes?: number;
  attendanceStatus?: 'present' | 'late' | 'absent';
  attendanceDate?: Date;
  metadata?: Record<string, any>;
}

export interface CourseProgressSummary {
  courseId: string;
  totalClasses: number;
  completedClasses: number;
  completionPercentage: number;
  totalVideoMinutes: number;
  watchedVideoMinutes: number;
  attendedClasses: number;
  isCompleted: boolean;
  completedAt?: Date;
  lastActivityAt: Date;
  streak: number;
  longestStreak: number;
  averageVideoWatchPercentage: number;
}

@Injectable()
export class UserProgressService {
  private readonly logger = new Logger(UserProgressService.name);

  constructor(
    @InjectModel(UserClassProgress.name)
    private userClassProgressModel: Model<UserClassProgressDocument>,
    @InjectModel(UserCourseProgress.name)
    private userCourseProgressModel: Model<UserCourseProgressDocument>,
    @InjectModel(Class.name)
    private classModel: Model<ClassDocument>,
    @InjectModel(Course.name)
    private courseModel: Model<CourseDocument>,
    @InjectModel(Playlist.name)
    private playlistModel: Model<PlaylistDocument>,
  ) {}

  /**
   * Update user progress for a specific class
   */
  async updateClassProgress(
    data: ProgressUpdateData,
  ): Promise<UserClassProgressDocument> {
    try {
      const {
        userId,
        classId,
        courseId,
        schoolId,
        videoWatchPercentage,
        timeSpentMinutes,
        attendanceStatus,
        attendanceDate,
        metadata,
      } = data;

      // Find or create class progress record
      let classProgress = await this.userClassProgressModel.findOne({
        user: new Types.ObjectId(userId),
        class: new Types.ObjectId(classId),
      });

      if (!classProgress) {
        classProgress = new this.userClassProgressModel({
          user: new Types.ObjectId(userId),
          class: new Types.ObjectId(classId),
          course: new Types.ObjectId(courseId),
          school: new Types.ObjectId(schoolId),
          firstAccessedAt: new Date(),
        });
      }

      // Update progress data
      classProgress.lastAccessedAt = new Date();

      if (videoWatchPercentage !== undefined) {
        classProgress.videoWatchPercentage = Math.max(
          classProgress.videoWatchPercentage,
          videoWatchPercentage,
        );
      }

      if (timeSpentMinutes !== undefined) {
        classProgress.timeSpentMinutes += timeSpentMinutes;
      }

      if (attendanceStatus) {
        classProgress.attendanceMarked = true;
        classProgress.attendanceStatus = attendanceStatus;
        classProgress.attendanceDate = attendanceDate || new Date();
      }

      if (metadata) {
        classProgress.metadata = { ...classProgress.metadata, ...metadata };
      }

      // Determine if class is completed
      const wasCompleted = classProgress.completed;
      const isNowCompleted = this.isClassCompleted(classProgress);

      if (isNowCompleted && !wasCompleted) {
        classProgress.completed = true;
        classProgress.completedAt = new Date();
        this.logger.log(
          `Class ${classId} marked as completed for user ${userId}`,
        );
      }

      await classProgress.save();

      // Update course progress if class completion status changed
      if (isNowCompleted && !wasCompleted) {
        await this.updateCourseProgress(userId, courseId, schoolId);
      }

      return classProgress;
    } catch (error) {
      this.logger.error(`Error updating class progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Determine if a class is considered completed
   */
  private isClassCompleted(classProgress: UserClassProgressDocument): boolean {
    // Class is completed if:
    // 1. Video watched >= 90% OR
    // 2. Attendance marked as present/late
    return (
      classProgress.videoWatchPercentage >= 90 ||
      (classProgress.attendanceMarked &&
        classProgress.attendanceStatus !== 'absent')
    );
  }

  /**
   * Update course progress summary
   */
  async updateCourseProgress(
    userId: string,
    courseId: string,
    schoolId: string,
  ): Promise<UserCourseProgressDocument> {
    try {
      // Get total classes in course (including playlists)
      const totalClasses = await this.getTotalClassesInCourse(courseId);

      // Get user's class progress for this course
      const classProgresses = await this.userClassProgressModel.find({
        user: new Types.ObjectId(userId),
        course: new Types.ObjectId(courseId),
      });

      // Calculate completion metrics
      const completedClasses = classProgresses.filter(
        (cp) => cp.completed,
      ).length;
      const completionPercentage =
        totalClasses > 0
          ? Math.round((completedClasses / totalClasses) * 100)
          : 0;
      const attendedClasses = classProgresses.filter(
        (cp) => cp.attendanceMarked && cp.attendanceStatus !== 'absent',
      ).length;

      // Debug logging for course completion calculation
      this.logger.log(
        `Course Progress Debug for user ${userId}, course ${courseId}:`,
      );
      this.logger.log(`  - Total classes in course: ${totalClasses}`);
      this.logger.log(
        `  - User class progresses found: ${classProgresses.length}`,
      );
      this.logger.log(`  - Completed classes: ${completedClasses}`);
      this.logger.log(`  - Completion percentage: ${completionPercentage}%`);

      // Log individual class progress details
      classProgresses.forEach((cp, index) => {
        this.logger.log(
          `  - Class ${index + 1}: ${cp.class} - ${cp.completed ? 'COMPLETED' : 'NOT COMPLETED'} (${cp.videoWatchPercentage}% watched)`,
        );
      });

      // Calculate video metrics
      const totalVideoMinutes =
        await this.getTotalVideoMinutesInCourse(courseId);
      const watchedVideoMinutes = classProgresses.reduce((sum, cp) => {
        return sum + (cp.timeSpentMinutes || 0);
      }, 0);

      const averageVideoWatchPercentage =
        classProgresses.length > 0
          ? Math.round(
              classProgresses.reduce(
                (sum, cp) => sum + cp.videoWatchPercentage,
                0,
              ) / classProgresses.length,
            )
          : 0;

      // Calculate streaks
      const { streak, longestStreak } = this.calculateStreaks(classProgresses);

      // Find or create course progress record
      let courseProgress = await this.userCourseProgressModel.findOne({
        user: new Types.ObjectId(userId),
        course: new Types.ObjectId(courseId),
      });

      if (!courseProgress) {
        courseProgress = new this.userCourseProgressModel({
          user: new Types.ObjectId(userId),
          course: new Types.ObjectId(courseId),
          school: new Types.ObjectId(schoolId),
          enrolledAt: new Date(),
        });
      }

      // Update course progress
      const wasCompleted = courseProgress.isCompleted;
      courseProgress.totalClasses = totalClasses;
      courseProgress.completedClasses = completedClasses;
      courseProgress.completionPercentage = completionPercentage;
      courseProgress.totalVideoMinutes = totalVideoMinutes;
      courseProgress.watchedVideoMinutes = watchedVideoMinutes;
      courseProgress.attendedClasses = attendedClasses;
      courseProgress.averageVideoWatchPercentage = averageVideoWatchPercentage;
      courseProgress.lastActivityAt = new Date();
      courseProgress.streak = streak;
      courseProgress.longestStreak = Math.max(
        courseProgress.longestStreak,
        longestStreak,
      );

      // Mark course as completed if threshold met (80% completion)
      const isNowCompleted = completionPercentage >= 80;
      if (isNowCompleted && !wasCompleted) {
        courseProgress.isCompleted = true;
        courseProgress.completedAt = new Date();
        this.logger.log(
          `Course ${courseId} marked as completed for user ${userId}`,
        );
      }

      await courseProgress.save();
      return courseProgress;
    } catch (error) {
      this.logger.error(`Error updating course progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get total classes in a course including playlist classes
   */
  async getTotalClassesInCourse(courseId: string): Promise<number> {
    try {
      // Get direct classes
      const course = await this.courseModel
        .findById(courseId)
        .populate('classes');
      const directClassIds = course?.classes?.map((c: any) => c._id) || [];

      // Get playlist classes
      const playlists = await this.playlistModel.find({
        course: new Types.ObjectId(courseId),
      });
      const playlistClassIds = playlists.reduce((acc: any[], playlist) => {
        return acc.concat(playlist.classes || []);
      }, []);

      // Combine all class IDs (direct + playlists)
      const allClassIds = [...directClassIds, ...playlistClassIds];

      // Only count classes that are active and public (matching UI)
      const filteredClasses = await this.classModel.find({
        _id: { $in: allClassIds },
        isActive: true,
      });

      const totalClasses = filteredClasses.length;

      // Debug logging
      this.logger.log(`Total Classes Debug for course ${courseId}:`);
      this.logger.log(`  - Direct classes: ${directClassIds.length}`);
      this.logger.log(`  - Playlists found: ${playlists.length}`);
      this.logger.log(`  - Classes in playlists: ${playlistClassIds.length}`);
      this.logger.log(`  - Filtered (active+public) classes: ${totalClasses}`);

      // Log playlist details
      playlists.forEach((playlist, index) => {
        this.logger.log(
          `  - Playlist ${index + 1}: "${playlist.name}" with ${playlist.classes?.length || 0} classes`,
        );
      });

      return totalClasses;
    } catch (error) {
      this.logger.error(
        `Error getting total classes for course ${courseId}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Get total video minutes in a course
   */
  async getTotalVideoMinutesInCourse(courseId: string): Promise<number> {
    try {
      // Get all class IDs in course
      const course = await this.courseModel
        .findById(courseId)
        .populate('classes');
      const directClassIds = course?.classes?.map((c: any) => c._id) || [];

      const playlists = await this.playlistModel.find({
        course: new Types.ObjectId(courseId),
      });
      const playlistClassIds = playlists.reduce((acc, playlist) => {
        return acc.concat(playlist.classes || []);
      }, []);

      const allClassIds = [...directClassIds, ...playlistClassIds];

      // Get video durations
      const classes = await this.classModel.find({ _id: { $in: allClassIds } });
      return classes.reduce((sum, classItem) => {
        const duration = classItem.videoMetadata?.duration || 0;
        return sum + Math.round(duration / 60); // Convert seconds to minutes
      }, 0);
    } catch (error) {
      this.logger.error(
        `Error getting total video minutes for course ${courseId}: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Calculate completion streaks
   */
  private calculateStreaks(classProgresses: UserClassProgressDocument[]): {
    streak: number;
    longestStreak: number;
  } {
    const completedProgresses = classProgresses
      .filter((cp) => cp.completed)
      .sort(
        (a, b) =>
          (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0),
      );

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < completedProgresses.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevDate = completedProgresses[i - 1].completedAt;
        const currentDate = completedProgresses[i].completedAt;

        if (prevDate && currentDate) {
          const daysDiff =
            Math.abs(currentDate.getTime() - prevDate.getTime()) /
            (1000 * 60 * 60 * 24);
          if (daysDiff <= 7) {
            // Within a week
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        }
      }

      longestStreak = Math.max(longestStreak, tempStreak);

      // Current streak is the last consecutive sequence
      if (i === completedProgresses.length - 1) {
        currentStreak = tempStreak;
      }
    }

    return { streak: currentStreak, longestStreak };
  }

  /**
   * Get user's progress for a specific course
   */
  async getUserCourseProgress(
    userId: string,
    courseId: string,
  ): Promise<CourseProgressSummary | null> {
    try {
      const courseProgress = await this.userCourseProgressModel.findOne({
        user: new Types.ObjectId(userId),
        course: new Types.ObjectId(courseId),
      });

      if (!courseProgress) {
        return null;
      }

      return {
        courseId: courseProgress.course.toString(),
        totalClasses: courseProgress.totalClasses,
        completedClasses: courseProgress.completedClasses,
        completionPercentage: courseProgress.completionPercentage,
        totalVideoMinutes: courseProgress.totalVideoMinutes,
        watchedVideoMinutes: courseProgress.watchedVideoMinutes,
        attendedClasses: courseProgress.attendedClasses,
        isCompleted: courseProgress.isCompleted,
        completedAt: courseProgress.completedAt,
        lastActivityAt: courseProgress.lastActivityAt,
        streak: courseProgress.streak,
        longestStreak: courseProgress.longestStreak,
        averageVideoWatchPercentage: courseProgress.averageVideoWatchPercentage,
      };
    } catch (error) {
      this.logger.error(`Error getting user course progress: ${error.message}`);
      return null;
    }
  }

  /**
   * Get user's progress for all courses
   */
  async getUserCoursesProgress(
    userId: string,
    schoolId?: string,
  ): Promise<CourseProgressSummary[]> {
    try {
      const query: any = { user: new Types.ObjectId(userId) };
      if (schoolId) {
        query.school = new Types.ObjectId(schoolId);
      }

      const courseProgresses = await this.userCourseProgressModel.find(query);

      return courseProgresses.map((cp) => ({
        courseId: cp.course.toString(),
        totalClasses: cp.totalClasses,
        completedClasses: cp.completedClasses,
        completionPercentage: cp.completionPercentage,
        totalVideoMinutes: cp.totalVideoMinutes,
        watchedVideoMinutes: cp.watchedVideoMinutes,
        attendedClasses: cp.attendedClasses,
        isCompleted: cp.isCompleted,
        completedAt: cp.completedAt,
        lastActivityAt: cp.lastActivityAt,
        streak: cp.streak,
        longestStreak: cp.longestStreak,
        averageVideoWatchPercentage: cp.averageVideoWatchPercentage,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting user courses progress: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Initialize progress tracking for a user when they enroll in a course
   */
  async initializeCourseProgress(
    userId: string,
    courseId: string,
    schoolId: string,
  ): Promise<UserCourseProgressDocument> {
    try {
      // Check if progress already exists
      const existingProgress = await this.userCourseProgressModel.findOne({
        user: new Types.ObjectId(userId),
        course: new Types.ObjectId(courseId),
      });

      if (existingProgress) {
        return existingProgress;
      }

      // Create new course progress record
      const courseProgress = new this.userCourseProgressModel({
        user: new Types.ObjectId(userId),
        course: new Types.ObjectId(courseId),
        school: new Types.ObjectId(schoolId),
        enrolledAt: new Date(),
      });

      await courseProgress.save();

      // Update with actual course data
      return await this.updateCourseProgress(userId, courseId, schoolId);
    } catch (error) {
      this.logger.error(`Error initializing course progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get detailed class progress for a user in a course
   */
  async getUserClassProgressInCourse(
    userId: string,
    courseId: string,
  ): Promise<UserClassProgressDocument[]> {
    try {
      return await this.userClassProgressModel
        .find({
          user: new Types.ObjectId(userId),
          course: new Types.ObjectId(courseId),
        })
        .populate('class', 'title order videoMetadata')
        .sort({ 'class.order': 1 });
    } catch (error) {
      this.logger.error(`Error getting user class progress: ${error.message}`);
      return [];
    }
  }
}
