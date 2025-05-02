import { IsDate, IsBoolean, IsString, IsMongoId, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAttendanceDto {
  @IsMongoId()
  studentId: string;

  @IsMongoId()
  courseId: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsBoolean()
  @IsOptional()
  present: boolean = true;

  @IsString()
  @IsOptional()
  notes: string;
} 