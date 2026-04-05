import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceFacade } from './services/attendance.facade';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { AuthModule } from '../auth/auth.module';
import { RemoveClassFieldMigration } from './migration/remove-class-field.migration';
import { CoursesModule } from '../courses/courses.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
    AuthModule,
    forwardRef(() => CoursesModule),
    GamificationModule,
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    AttendanceFacade,
    RemoveClassFieldMigration,
  ],
  exports: [
    AttendanceService,
    AttendanceFacade,
    RemoveClassFieldMigration,
  ],
})
export class AttendanceModule {}
