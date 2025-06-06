import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { Class, ClassSchema } from './schemas/class.schema';
import { Playlist, PlaylistSchema } from './schemas/playlist.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { ServicesModule } from '../services/services.module';
import { Enrollment, EnrollmentSchema } from '../courses/schemas/enrollment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Class.name, schema: ClassSchema },
      { name: Playlist.name, schema: PlaylistSchema },
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
    ]),
    AuthModule,
    CoursesModule,
    UsersModule,
    ServicesModule,
  ],
  controllers: [ClassesController, PlaylistsController],
  providers: [ClassesService, PlaylistsService],
  exports: [ClassesService, PlaylistsService],
})
export class ClassesModule {} 