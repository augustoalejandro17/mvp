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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationsFacade } from './services/notifications.facade';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsFacade: NotificationsFacade,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsFacade.create(createNotificationDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findUserNotifications(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('unreadOnly') unreadOnly: string = 'false',
  ) {
    return this.notificationsFacade.findUserNotifications(
      req,
      page,
      limit,
      unreadOnly,
    );
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Request() req) {
    return this.notificationsFacade.getUnreadCount(req);
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsFacade.markAsRead(id, req);
  }

  @Put('mark-all-read')
  @UseGuards(JwtAuthGuard)
  async markAllAsRead(@Request() req) {
    return this.notificationsFacade.markAllAsRead(req);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteNotification(@Param('id') id: string, @Request() req) {
    return this.notificationsFacade.deleteNotification(id, req);
  }

  @Get('debug/count')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getDebugCount(): Promise<{ total: number; unread: number }> {
    return this.notificationsFacade.getDebugCounts();
  }

  @Get('debug/counts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getDebugCounts() {
    return this.notificationsFacade.getDebugCounts();
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getHealth() {
    return this.notificationsFacade.getHealth();
  }
}
