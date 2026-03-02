import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserReportReason } from '../schemas/user-report.schema';

export class CreateUserReportDto {
  @IsString()
  @IsNotEmpty({ message: 'reportedUserId es obligatorio' })
  @MaxLength(64)
  reportedUserId: string;

  @IsEnum(UserReportReason, {
    message:
      'reason debe ser spam, harassment, hate, sexual, violence, impersonation, scam u other',
  })
  reason: UserReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
