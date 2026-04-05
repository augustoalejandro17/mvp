import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
  NotificationPriority,
} from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Course } from '../courses/schemas/course.schema';
import { User } from '../auth/schemas/user.schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly mvpVisibleTypes: NotificationType[] = [
    NotificationType.ENROLLMENT,
    NotificationType.NEW_CLASS,
    NotificationType.TEACHER_NEW_COURSE,
    NotificationType.ANNOUNCEMENT,
    NotificationType.FEEDBACK_SUBMISSION,
    NotificationType.FEEDBACK_REVIEW,
    NotificationType.COURSE_ACCESS,
    NotificationType.GENERAL,
    NotificationType.SYSTEM,
  ];

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(Course.name)
    private courseModel: Model<Course>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notification = new this.notificationModel(createNotificationDto);
    return notification.save();
  }

  async createClassReminder(
    recipientId: string,
    courseId: string,
    classStartTime: Date,
    notificationMinutes: number = 10,
  ): Promise<Notification> {
    const minutesText = notificationMinutes === 1 ? 'minuto' : 'minutos';

    const notification = new this.notificationModel({
      title: 'Recordatorio de Clase',
      message: `Tu clase comenzará en ${notificationMinutes} ${minutesText}`,
      type: NotificationType.CLASS_REMINDER,
      priority: NotificationPriority.HIGH,
      recipient: recipientId,
      relatedCourse: courseId,
      metadata: {
        classStartTime,
        courseId,
        notificationMinutes,
        actionUrl: `/course/${courseId}`,
      },
    });

    return notification.save();
  }

  async notifyStudentAddedToCourse(
    recipientId: string,
    courseId: string,
    senderId?: string,
  ): Promise<Notification | null> {
    const course = await this.courseModel.findById(courseId).select('title').lean();
    if (!course) {
      this.logger.warn(
        `Skipping enrollment notification because course ${courseId} was not found`,
      );
      return null;
    }

    const notification = new this.notificationModel({
      title: 'Te agregaron a un nuevo curso',
      message: `Ya tienes acceso a "${course.title}".`,
      type: NotificationType.ENROLLMENT,
      priority: NotificationPriority.HIGH,
      recipient: recipientId,
      sender: senderId,
      relatedCourse: courseId,
      metadata: {
        courseId,
        actionUrl: `/course/${courseId}`,
      },
    });

    return notification.save();
  }

  async notifyNewClassInCourse(
    courseId: string,
    classId: string,
    classTitle: string,
    senderId?: string,
  ): Promise<void> {
    const course = await this.courseModel
      .findById(courseId)
      .select('title students')
      .lean();

    if (!course) {
      this.logger.warn(
        `Skipping new-class notifications because course ${courseId} was not found`,
      );
      return;
    }

    const recipientIds = Array.isArray(course.students)
      ? course.students
          .map((studentId: any) => studentId?.toString?.() || String(studentId))
          .filter((studentId: string) => !!studentId && studentId !== senderId)
      : [];

    if (recipientIds.length === 0) {
      return;
    }

    await this.createBulkNotifications(
      recipientIds.map((recipient) => ({
        title: 'Nueva clase disponible',
        message: `Se agrego "${classTitle}" en ${course.title}.`,
        type: NotificationType.NEW_CLASS,
        priority: NotificationPriority.HIGH,
        recipient,
        sender: senderId,
        relatedCourse: courseId,
        metadata: {
          courseId,
          classId,
          classTitle,
          actionUrl: `/player/${classId}?courseId=${courseId}`,
        },
      })),
    );
  }

  async notifyTeacherPublishedNewCourse(
    courseId: string,
    teacherId: string,
  ): Promise<void> {
    const [course, teacher] = await Promise.all([
      this.courseModel.findById(courseId).select('title').lean(),
      this.userModel
        .findById(teacherId)
        .select('name teachingCourses role')
        .lean(),
    ]);

    if (!course || !teacher) {
      this.logger.warn(
        `Skipping teacher-course notifications because course ${courseId} or teacher ${teacherId} was not found`,
      );
      return;
    }

    const followedCourseIds = Array.isArray((teacher as any).teachingCourses)
      ? (teacher as any).teachingCourses
          .map((id: any) => id?.toString?.() || String(id))
          .filter((id: string) => !!id && id !== courseId)
      : [];

    if (followedCourseIds.length === 0) {
      return;
    }

    const recipientIds = await this.userModel.distinct('_id', {
      role: 'student',
      isActive: true,
      enrolledCourses: {
        $in: followedCourseIds.map((id) => new Types.ObjectId(id)),
      },
    });

    const filteredRecipientIds = recipientIds
      .map((recipientId) => recipientId.toString())
      .filter((recipientId) => recipientId !== teacherId);

    if (filteredRecipientIds.length === 0) {
      return;
    }

    await this.createBulkNotifications(
      filteredRecipientIds.map((recipient) => ({
        title: 'Tu profesor publico un nuevo curso',
        message: `${teacher.name} publico "${course.title}".`,
        type: NotificationType.TEACHER_NEW_COURSE,
        priority: NotificationPriority.MEDIUM,
        recipient,
        sender: teacherId,
        relatedCourse: courseId,
        metadata: {
          courseId,
          teacherId,
          teacherName: teacher.name,
          actionUrl: `/course/${courseId}`,
        },
      })),
    );
  }

  async findUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    const skip = (page - 1) * limit;
    const filter: any = {
      recipient: userId,
      isDeleted: false,
      isActive: true,
      type: { $in: this.mvpVisibleTypes },
    };

    if (unreadOnly) {
      filter.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .populate('sender', 'name email')
        .populate('relatedCourse', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({
        recipient: userId,
        isRead: false,
        isDeleted: false,
        isActive: true,
      }),
    ]);

    return { notifications, total, unreadCount };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification> {
    const notification = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: notificationId,
          recipient: userId,
          isDeleted: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        },
        { new: true },
      )
      .exec();

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel
      .updateMany(
        {
          recipient: userId,
          isRead: false,
          isDeleted: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        },
      )
      .exec();
  }

  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.notificationModel
      .updateOne(
        {
          _id: notificationId,
          recipient: userId,
        },
        {
          isDeleted: true,
          deletedAt: new Date(),
        },
      )
      .exec();

    if (result.matchedCount === 0) {
      throw new NotFoundException('Notificación no encontrada');
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({
        recipient: userId,
        isRead: false,
        isDeleted: false,
        isActive: true,
      })
      .exec();
  }

  // Method to send bulk notifications
  async createBulkNotifications(notifications: CreateNotificationDto[]) {
    if (!notifications.length) {
      return [];
    }
    return this.notificationModel.insertMany(notifications);
  }

  // Clean up old notifications (optional cleanup service)
  async cleanupOldNotifications(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await this.notificationModel
      .deleteMany({
        createdAt: { $lt: cutoffDate },
        isDeleted: true,
      })
      .exec();

    this.logger.log(`Cleaned up notifications older than ${daysOld} days`);
  }

  // Health check method
  async checkDatabaseHealth(): Promise<{
    status: string;
    timestamp: Date;
    collections: { notifications: number };
  }> {
    try {
      const count = await this.notificationModel.countDocuments({}).exec();

      return {
        status: 'healthy',
        timestamp: new Date(),
        collections: {
          notifications: count,
        },
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error.message);
      throw error;
    }
  }

  // Debug methods
  async countAll(): Promise<number> {
    return this.notificationModel.countDocuments({}).exec();
  }

  async countUnread(): Promise<number> {
    return this.notificationModel
      .countDocuments({
        isRead: false,
        isDeleted: false,
        isActive: true,
      })
      .exec();
  }
}
