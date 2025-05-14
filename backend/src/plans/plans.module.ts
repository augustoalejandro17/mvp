import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema }
    ])
  ],
  controllers: [PlansController, SubscriptionsController],
  providers: [PlansService, SubscriptionsService],
  exports: [PlansService, SubscriptionsService]
})
export class PlansModule {} 