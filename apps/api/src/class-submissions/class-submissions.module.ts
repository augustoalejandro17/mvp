import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import {
  Enrollment,
  EnrollmentSchema,
} from '../courses/schemas/enrollment.schema';
import { ServicesModule } from '../services/services.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClassSubmissionsController } from './class-submissions.controller';
import { ClassSubmissionsService } from './class-submissions.service';
import {
  ClassSubmission,
  ClassSubmissionSchema,
} from './schemas/class-submission.schema';
import {
  SubmissionAnnotation,
  SubmissionAnnotationSchema,
} from './schemas/submission-annotation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClassSubmission.name, schema: ClassSubmissionSchema },
      { name: SubmissionAnnotation.name, schema: SubmissionAnnotationSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    ServicesModule,
    NotificationsModule,
  ],
  controllers: [ClassSubmissionsController],
  providers: [ClassSubmissionsService],
  exports: [ClassSubmissionsService],
})
export class ClassSubmissionsModule {}
