import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BulkUploadController } from './bulk-upload.controller';
import { BulkUploadService } from './bulk-upload.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { UsersModule } from '../users/users.module';
import { CoursesModule } from '../courses/courses.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Course.name, schema: CourseSchema },
      { name: School.name, schema: SchoolSchema },
    ]),
    UsersModule,
    CoursesModule,
  ],
  controllers: [BulkUploadController],
  providers: [BulkUploadService],
  exports: [BulkUploadService],
})
export class BulkUploadModule {} 