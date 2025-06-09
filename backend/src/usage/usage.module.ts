import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsageTracking, UsageTrackingSchema } from './schemas/usage-tracking.schema';
import { UsageTrackingService } from './usage-tracking.service';
import { UsageTrackingController } from './usage-tracking.controller';
import { StorageIntegrationService } from './integration/storage-integration.service';
import { StreamingIntegrationService } from './integration/streaming-integration.service';
import { UsageHooksService } from './hooks/usage-hooks.service';

// Import other schemas needed for the service
import { User, UserSchema } from '../auth/schemas/user.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { Plan, PlanSchema } from '../plans/schemas/plan.schema';
import { Subscription, SubscriptionSchema } from '../plans/schemas/subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UsageTracking.name, schema: UsageTrackingSchema },
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [UsageTrackingController],
  providers: [
    UsageTrackingService,
    StorageIntegrationService,
    StreamingIntegrationService,
    UsageHooksService,
  ],
  exports: [
    UsageTrackingService,
    StorageIntegrationService,
    StreamingIntegrationService,
    UsageHooksService,
  ],
})
export class UsageModule {} 