import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { UserReportsController } from './user-reports.controller';
import { UserReportsFacade } from './services/user-reports.facade';
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
  providers: [UserReportsService, UserReportsFacade],
  exports: [UserReportsService, UserReportsFacade],
})
export class UserReportsModule {}
