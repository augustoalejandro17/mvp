import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductAnalyticsController } from './product-analytics.controller';
import { ProductAnalyticsFacade } from './services/product-analytics.facade';
import { ProductAnalyticsService } from './product-analytics.service';
import {
  ProductEvent,
  ProductEventSchema,
} from './schemas/product-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductEvent.name, schema: ProductEventSchema },
    ]),
  ],
  controllers: [ProductAnalyticsController],
  providers: [ProductAnalyticsService, ProductAnalyticsFacade],
  exports: [ProductAnalyticsService, ProductAnalyticsFacade],
})
export class ProductAnalyticsModule {}
