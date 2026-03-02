import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '../schemas/content-report.schema';

export class UpdateContentReportStatusDto {
  @IsEnum(ReportStatus, {
    message: 'status debe ser pending, under_review, action_taken o dismissed',
  })
  status: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  moderatorNotes?: string;
}
