import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Enrollment, EnrollmentSchema } from '../courses/schemas/enrollment.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { Subscription, SubscriptionSchema } from '../plans/schemas/subscription.schema';
import { Plan, PlanSchema } from '../plans/schemas/plan.schema';
import { RetentionService } from './services/retention.service';
import { PerformanceService } from './services/performance.service';
import { RevenueService } from './services/revenue.service';
import { DropoutService } from './services/dropout.service';
import { DemographicsService } from './services/demographics.service';
import { StatisticsController } from './controllers/statistics.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Plan.name, schema: PlanSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [
    RetentionService,
    PerformanceService,
    RevenueService,
    DropoutService,
    DemographicsService,
  ],
  exports: [
    RetentionService,
    PerformanceService,
    RevenueService,
    DropoutService,
    DemographicsService,
  ],
})
export class StatisticsModule {} 