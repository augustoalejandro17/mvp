import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatisticsController } from './statistics.controller';

import { StatisticsService } from './services/statistics.service';
import { SnapshotService } from './services/snapshot.service';
import { DailySnapshot, DailySnapshotSchema } from './schemas/daily-snapshot.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Enrollment, EnrollmentSchema } from '../enrollments/schemas/enrollment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailySnapshot.name, schema: DailySnapshotSchema },
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService, SnapshotService],
  exports: [StatisticsService, SnapshotService],
})
export class StatisticsModule {} 