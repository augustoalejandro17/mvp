import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TrackEventDto } from './dto/track-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { ProductAnalyticsFacade } from './services/product-analytics.facade';

@Controller('product-analytics')
export class ProductAnalyticsController {
  constructor(
    private readonly productAnalyticsFacade: ProductAnalyticsFacade,
  ) {}

  @Post('events')
  @UseGuards(JwtAuthGuard)
  async trackEvent(@Req() req: Request, @Body() dto: TrackEventDto) {
    return this.productAnalyticsFacade.trackEvent(req, dto);
  }

  @Get('funnel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getFunnel(@Query('days') days?: string) {
    return this.productAnalyticsFacade.getFunnel(days);
  }
}
