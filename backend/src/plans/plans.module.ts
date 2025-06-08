import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController as UserSubscriptionsController } from './subscriptions.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { AdminPlanController } from './controllers/admin-plan.controller';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { Overage, OverageSchema } from './schemas/overage.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Overage.name, schema: OverageSchema },
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema }
    ])
  ],
  controllers: [PlansController, UserSubscriptionsController, SubscriptionsController, AdminPlanController],
  providers: [PlansService, SubscriptionsService],
  exports: [PlansService, SubscriptionsService]
})
export class PlansModule {} 