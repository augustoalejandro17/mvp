import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchoolsModule } from './schools/schools.module';
import { CoursesModule } from './courses/courses.module';
import { ClassesModule } from './classes/classes.module';
import { ServicesModule } from './services/services.module';
import { UploadModule } from './upload/upload.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PlansModule } from './plans/plans.module';
import { StatisticsModule } from './statistics/statistics.module';
import { ReportsModule } from './reports/reports.module';
import { CategoriesModule } from './categories/categories.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { BulkUploadModule } from './bulk-upload/bulk-upload.module';
import { UsageModule } from './usage/usage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { VideosModule } from './videos/videos.module';
import { GamificationModule } from './gamification/gamification.module';
import { ProgressModule } from './progress/progress.module';
import { AnalysisModule } from './analysis/analysis.module';
import { CoachModule } from './coach/coach.module';
import { DatabaseModule } from './db/db.module';
import awsConfig from './config/aws.config';
import { S3Service } from './services/s3.service';
import { CloudFrontService } from './services/cloudfront.service';
import { ImagesController } from './controllers/images.controller';
import { SubscriptionAdminController } from './controllers/subscription-admin.controller';
import { AdminStatsController } from './controllers/admin-stats.controller';
import { ApiStatsController } from './controllers/api-stats.controller';

import { User, UserSchema } from './auth/schemas/user.schema';
import { School, SchoolSchema } from './schools/schemas/school.schema';
import { Course, CourseSchema } from './courses/schemas/course.schema';
import { Class, ClassSchema } from './classes/schemas/class.schema';
import { Plan, PlanSchema } from './plans/schemas/plan.schema';
import {
  Subscription,
  SubscriptionSchema,
} from './plans/schemas/subscription.schema';
import {
  UserOwnedSchoolsController,
  UserAdministeredSchoolsController,
} from './schools/schools.controller';
import { MigrationService } from './migrations/migration.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [awsConfig],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    MongooseModule.forRoot(process.env.MONGODB_URI, {
      // Connection pool settings
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      
      // Connection timeout settings
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      
      // Retry settings
      retryWrites: true,
      retryReads: true,
      
      // Heartbeat settings
      heartbeatFrequencyMS: 10000,
      
      // Connection monitoring
      monitorCommands: true,
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    AuthModule,
    UsersModule,
    SchoolsModule,
    CoursesModule,
    ClassesModule,
    ServicesModule,
    UploadModule,
    AttendanceModule,
    PlansModule,
    StatisticsModule,
    ReportsModule,
    CategoriesModule,
    EnrollmentsModule,
    BulkUploadModule,
    UsageModule,
    NotificationsModule,
    VideosModule,
    GamificationModule,
    ProgressModule,
    AnalysisModule,
    CoachModule,
  ],
  controllers: [
    AppController,
    ImagesController,
    SubscriptionAdminController,
    UserOwnedSchoolsController,
    UserAdministeredSchoolsController,
    AdminStatsController,
    ApiStatsController,
  ],
  providers: [AppService, S3Service, CloudFrontService, MigrationService],
})
export class AppModule {}
