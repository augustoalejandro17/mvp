import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CourseMonthlyAttendanceDto {
  @IsString()
  courseId: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsDateString()
  referenceDate?: string;
}
