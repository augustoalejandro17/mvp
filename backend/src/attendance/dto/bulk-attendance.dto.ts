import { IsDate, IsBoolean, IsString, IsMongoId, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class StudentAttendanceDto {
  @IsMongoId()
  studentId: string;

  @IsBoolean()
  present: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkAttendanceDto {
  @IsMongoId()
  courseId: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentAttendanceDto)
  attendances: StudentAttendanceDto[];
} 