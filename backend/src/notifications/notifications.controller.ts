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
  Request
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

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
    @Query('unreadOnly') unreadOnly: string = 'false'
  ) {
    const userId = req.user._id || req.user.sub;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const result = await this.notificationsService.findUserNotifications(
      userId,
      pageNum,
      limitNum,
      unreadOnly === 'true'
    );

    return {
      ...result,
      currentPage: pageNum,
      totalPages: Math.ceil(result.total / limitNum)
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
  async getDebugCount(): Promise<{ total: number, unread: number }> {
    const total = await this.notificationsService.countAll();
    const unread = await this.notificationsService.countUnread();
    return { total, unread };
  }
} 