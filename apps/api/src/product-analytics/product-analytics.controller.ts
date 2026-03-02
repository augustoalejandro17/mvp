import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ProductAnalyticsService } from './product-analytics.service';
import { TrackEventDto } from './dto/track-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('product-analytics')
export class ProductAnalyticsController {
  constructor(
    private readonly productAnalyticsService: ProductAnalyticsService,
  ) {}

  @Post('events')
  @UseGuards(JwtAuthGuard)
  async trackEvent(@Req() req: Request, @Body() dto: TrackEventDto) {
    const userId = req.user?.['sub'] || req.user?.['_id'];
    return this.productAnalyticsService.trackEvent({
      event: dto.event,
      userId: userId ? String(userId) : undefined,
      properties: dto.properties,
    });
  }

  @Get('funnel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getFunnel(@Query('days') days?: string) {
    const parsedDays = days ? Number.parseInt(days, 10) : 30;
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      throw new BadRequestException('days debe ser un entero entre 1 y 365');
    }
    return this.productAnalyticsService.getFunnel(parsedDays);
  }
}
