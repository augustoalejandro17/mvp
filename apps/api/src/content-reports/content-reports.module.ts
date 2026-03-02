import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { ContentReportsController } from './content-reports.controller';
import { ContentReportsService } from './content-reports.service';
import {
  ContentReport,
  ContentReportSchema,
} from './schemas/content-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ContentReport.name, schema: ContentReportSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Course.name, schema: CourseSchema },
      { name: School.name, schema: SchoolSchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [ContentReportsController],
  providers: [ContentReportsService],
  exports: [ContentReportsService],
})
export class ContentReportsModule {}
