import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAttendanceDto {
  @IsBoolean()
  @IsOptional()
  present?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
} 