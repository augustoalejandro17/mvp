import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CoursesFacade } from './services/courses.facade';
import { CourseScheduleFacade } from './services/course-schedule.facade';
import { CourseEnrollmentsFacade } from './services/enrollments.facade';
import { Course, CourseSchema } from './schemas/course.schema';
import {
  CourseSchedule,
  CourseScheduleSchema,
} from './schemas/course-schedule.schema';
import { CourseScheduleService } from './course-schedule.service';
import { CourseScheduleController } from './course-schedule.controller';
import { AuthModule } from '../auth/auth.module';
import { SchoolsModule } from '../schools/schools.module';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { Enrollment, EnrollmentSchema } from './schemas/enrollment.schema';
import { EnrollmentsController } from './enrollments.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: CourseSchedule.name, schema: CourseScheduleSchema },
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => NotificationsModule),
    SchoolsModule,
    UsersModule,
  ],
  controllers: [
    CoursesController,
    EnrollmentsController,
    CourseScheduleController,
  ],
  providers: [
    CoursesService,
    CoursesFacade,
    CourseScheduleService,
    CourseScheduleFacade,
    CourseEnrollmentsFacade,
  ],
  exports: [CoursesService, CourseScheduleService],
})
export class CoursesModule {}
