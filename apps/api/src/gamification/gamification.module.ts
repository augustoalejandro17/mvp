import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

// Schemas
import { Badge, BadgeSchema } from './schemas/badge.schema';
import {
  UserAchievement,
  UserAchievementSchema,
} from './schemas/user-achievement.schema';
import { UserPoints, UserPointsSchema } from './schemas/user-points.schema';
import { Level, LevelSchema } from './schemas/level.schema';
import { Leaderboard, LeaderboardSchema } from './schemas/leaderboard.schema';

// Services
import { BadgeService } from './services/badge.service';
import { PointsService } from './services/points.service';
import { LeaderboardService } from './services/leaderboard.service';
import { GamificationIntegrationService } from './services/gamification-integration.service';

// Controllers
import { BadgeController } from './controllers/badge.controller';
import { PointsController } from './controllers/points.controller';
import { LeaderboardController } from './controllers/leaderboard.controller';

// External dependencies
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProgressModule } from '../progress/progress.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      // Gamification schemas
      { name: Badge.name, schema: BadgeSchema },
      { name: UserAchievement.name, schema: UserAchievementSchema },
      { name: UserPoints.name, schema: UserPointsSchema },
      { name: Level.name, schema: LevelSchema },
      { name: Leaderboard.name, schema: LeaderboardSchema },

      // External schemas needed for relationships
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Class.name, schema: ClassSchema },
    ]),

    // External modules
    forwardRef(() => AuthModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => ProgressModule),

    // For scheduled tasks
    ScheduleModule.forRoot(),
  ],

  controllers: [BadgeController, PointsController, LeaderboardController],

  providers: [
    BadgeService,
    PointsService,
    LeaderboardService,
    GamificationIntegrationService,
  ],

  exports: [
    BadgeService,
    PointsService,
    LeaderboardService,
    GamificationIntegrationService,
  ],
})
export class GamificationModule {}
