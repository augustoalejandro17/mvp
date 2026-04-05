import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';

@Injectable()
export class NotificationsFacade {
  constructor(private readonly notificationsService: NotificationsService) {}

  private getUserId(req: any): string {
    return String(req.user._id || req.user.sub);
  }

  private parsePagination(
    page: string = '1',
    limit: string = '20',
    unreadOnly: string = 'false',
  ) {
    const pageNum = Number.parseInt(page, 10);
    const limitNum = Number.parseInt(limit, 10);
    const unreadOnlyBool = unreadOnly === 'true' || unreadOnly === '1';

    if (!Number.isInteger(pageNum) || pageNum < 1) {
      throw new BadRequestException(
        'El parámetro page debe ser un entero >= 1',
      );
    }

    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException(
        'El parámetro limit debe ser un entero entre 1 y 100',
      );
    }

    return { pageNum, limitNum, unreadOnlyBool };
  }

  create(createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  async findUserNotifications(
    req: any,
    page: string = '1',
    limit: string = '20',
    unreadOnly: string = 'false',
  ) {
    const userId = this.getUserId(req);
    const { pageNum, limitNum, unreadOnlyBool } = this.parsePagination(
      page,
      limit,
      unreadOnly,
    );

    const result = await this.notificationsService.findUserNotifications(
      userId,
      pageNum,
      limitNum,
      unreadOnlyBool,
    );

    return {
      ...result,
      currentPage: pageNum,
      totalPages: Math.ceil(result.total / limitNum),
    };
  }

  async getUnreadCount(req: any) {
    const userId = this.getUserId(req);
    return { count: await this.notificationsService.getUnreadCount(userId) };
  }

  async markAsRead(id: string, req: any) {
    const userId = this.getUserId(req);
    return this.notificationsService.markAsRead(id, userId);
  }

  async markAllAsRead(req: any) {
    const userId = this.getUserId(req);
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(id: string, req: any) {
    const userId = this.getUserId(req);
    await this.notificationsService.deleteNotification(id, userId);
    return { message: 'Notification deleted' };
  }

  async getDebugCounts() {
    const [total, unread] = await Promise.all([
      this.notificationsService.countAll(),
      this.notificationsService.countUnread(),
    ]);

    return { total, unread };
  }

  async getHealth() {
    try {
      const health = await this.notificationsService.checkDatabaseHealth();
      return {
        service: 'notifications',
        ...health,
      };
    } catch (error) {
      return {
        service: 'notifications',
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message,
      };
    }
  }
}
