import { IsDate, IsBoolean, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAttendanceDto {
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  date?: Date;

  @IsBoolean()
  @IsOptional()
  present?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
} 