import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserReportStatus } from '../schemas/user-report.schema';

export class UpdateUserReportStatusDto {
  @IsEnum(UserReportStatus, {
    message:
      'status debe ser pending, under_review, action_taken o dismissed',
  })
  status: UserReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  moderatorNotes?: string;
}
