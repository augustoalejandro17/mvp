import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UserClassProgress,
  UserClassProgressSchema,
} from './schemas/user-class-progress.schema';
import {
  UserCourseProgress,
  UserCourseProgressSchema,
} from './schemas/user-course-progress.schema';
import { UserProgressService } from './services/user-progress.service';
import { ProgressController } from './progress.controller';

// Import schemas from other modules
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Playlist, PlaylistSchema } from '../classes/schemas/playlist.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserClassProgress.name, schema: UserClassProgressSchema },
      { name: UserCourseProgress.name, schema: UserCourseProgressSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Playlist.name, schema: PlaylistSchema },
    ]),
  ],
  controllers: [ProgressController],
  providers: [UserProgressService],
  exports: [UserProgressService],
})
export class ProgressModule {}
