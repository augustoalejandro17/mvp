import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType, NotificationPriority } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = new this.notificationModel(createNotificationDto);
    return notification.save();
  }

  async createClassReminder(
    recipientId: string, 
    courseId: string, 
    classStartTime: Date,
    notificationMinutes: number = 10
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
        actionUrl: `/course/${courseId}`
      }
    });

    return notification.save();
  }

  async findUserNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    const skip = (page - 1) * limit;
    const filter: any = {
      recipient: userId,
      isDeleted: false,
      isActive: true
    };

    if (unreadOnly) {
      filter.isRead = false;
    }

    this.logger.debug(`📋 Finding notifications for user ${userId}, filter:`, filter);

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
        isActive: true
      })
    ]);

    return { notifications, total, unreadCount };
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationModel.findOneAndUpdate(
      { 
        _id: notificationId, 
        recipient: userId,
        isDeleted: false 
      },
      { 
        isRead: true, 
        readAt: new Date() 
      },
      { new: true }
    ).exec();

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { 
        recipient: userId, 
        isRead: false,
        isDeleted: false 
      },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    ).exec();
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    this.logger.debug(`🗑️ Deleting notification ${notificationId} for user ${userId}`);
    
    const result = await this.notificationModel.updateOne(
      { 
        _id: notificationId, 
        recipient: userId 
      },
      { 
        isDeleted: true, 
        deletedAt: new Date() 
      }
    ).exec();

    this.logger.debug(`📊 Delete result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);

    if (result.matchedCount === 0) {
      throw new NotFoundException('Notificación no encontrada');
    }

    this.logger.debug(`✅ Notification ${notificationId} marked as deleted`);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false,
      isActive: true
    }).exec();
  }

  // Method to send bulk notifications
  async createBulkNotifications(notifications: CreateNotificationDto[]) {
    return this.notificationModel.insertMany(notifications);
  }

  // Clean up old notifications (optional cleanup service)
  async cleanupOldNotifications(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await this.notificationModel.deleteMany({
      createdAt: { $lt: cutoffDate },
      isDeleted: true
    }).exec();

    this.logger.log(`Cleaned up notifications older than ${daysOld} days`);
  }

  // Debug methods
  async countAll(): Promise<number> {
    return this.notificationModel.countDocuments({}).exec();
  }

  async countUnread(): Promise<number> {
    return this.notificationModel.countDocuments({
      isRead: false,
      isDeleted: false,
      isActive: true
    }).exec();
  }
} 