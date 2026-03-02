import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findUserNotifications(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('unreadOnly') unreadOnly: string = 'false',
  ) {
    const userId = req.user._id || req.user.sub;
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

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Request() req) {
    const userId = req.user._id || req.user.sub;
    return { count: await this.notificationsService.getUnreadCount(userId) };
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.sub;
    return this.notificationsService.markAsRead(id, userId);
  }

  @Put('mark-all-read')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@Request() req) {
    const userId = req.user._id || req.user.sub;
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteNotification(@Param('id') id: string, @Request() req) {
    const userId = req.user._id || req.user.sub;
    await this.notificationsService.deleteNotification(id, userId);
    return { message: 'Notification deleted' };
  }

  @Get('debug/count')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getDebugCount(): Promise<{ total: number; unread: number }> {
    const total = await this.notificationsService.countAll();
    const unread = await this.notificationsService.countUnread();
    return { total, unread };
  }

  @Get('debug/counts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getDebugCounts() {
    const [total, unread] = await Promise.all([
      this.notificationsService.countAll(),
      this.notificationsService.countUnread(),
    ]);

    return {
      total,
      unread,
    };
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
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
