import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ReportContentType,
  ReportReason,
} from '../schemas/content-report.schema';

export class CreateContentReportDto {
  @IsEnum(ReportContentType, {
    message: 'contentType debe ser class, course o school',
  })
  contentType: ReportContentType;

  @IsString()
  @IsNotEmpty({ message: 'contentId es obligatorio' })
  @MaxLength(64)
  contentId: string;

  @IsEnum(ReportReason, {
    message:
      'reason debe ser spam, harassment, hate, sexual, violence, misinformation, copyright u other',
  })
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contentTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
