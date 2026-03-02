import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { UserReportsController } from './user-reports.controller';
import { UserReportsService } from './user-reports.service';
import { UserReport, UserReportSchema } from './schemas/user-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserReport.name, schema: UserReportSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [UserReportsController],
  providers: [UserReportsService],
  exports: [UserReportsService],
})
export class UserReportsModule {}
