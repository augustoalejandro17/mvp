import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { TrackEventDto } from '../dto/track-event.dto';
import { ProductAnalyticsService } from '../product-analytics.service';

@Injectable()
export class ProductAnalyticsFacade {
  constructor(
    private readonly productAnalyticsService: ProductAnalyticsService,
  ) {}

  trackEvent(req: Request, dto: TrackEventDto) {
    const userId = req.user?.['sub'] || req.user?.['_id'];
    return this.productAnalyticsService.trackEvent({
      event: dto.event,
      userId: userId ? String(userId) : undefined,
      properties: dto.properties,
    });
  }

  getFunnel(days?: string) {
    const parsedDays = days ? Number.parseInt(days, 10) : 30;
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      throw new BadRequestException('days debe ser un entero entre 1 y 365');
    }
    return this.productAnalyticsService.getFunnel(parsedDays);
  }
}
