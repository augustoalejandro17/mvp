import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AuthModule } from '../auth/auth.module';
import {
  Attendance,
  AttendanceSchema,
} from '../attendance/schemas/attendance.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import {
  Enrollment,
  EnrollmentSchema,
} from '../courses/schemas/enrollment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Course.name, schema: CourseSchema },
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
    ]),
    AuthModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
