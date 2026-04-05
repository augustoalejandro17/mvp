import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersFacade } from './services/users.facade';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { AuthorizationService } from '../auth/services/authorization.service';
import {
  Attendance as CourseAttendance,
  AttendanceSchema as CourseAttendanceSchema,
} from '../attendance/schemas/attendance.schema';
import {
  Attendance as ClassAttendance,
  AttendanceSchema as ClassAttendanceSchema,
} from '../attendance/schemas/attendance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Course.name, schema: CourseSchema },
      { name: CourseAttendance.name, schema: CourseAttendanceSchema },
      { name: ClassAttendance.name, schema: ClassAttendanceSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersFacade, AuthorizationService],
  exports: [UsersService, UsersFacade],
})
export class UsersModule {}
