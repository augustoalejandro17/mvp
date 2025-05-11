import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { AuthModule } from '../auth/auth.module';
import { RemoveClassFieldMigration } from './migration/remove-class-field.migration';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
    AuthModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, RemoveClassFieldMigration],
  exports: [AttendanceService, RemoveClassFieldMigration],
})
export class AttendanceModule {} 