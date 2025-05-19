import { IsArray, IsBoolean, IsDateString, IsMongoId, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class StudentAttendance {
  @IsMongoId()
  @IsNotEmpty()
  studentId: string;

  @IsBoolean()
  @IsNotEmpty()
  present: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordAttendanceDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentAttendance)
  attendanceRecords: StudentAttendance[];

  studentsPresent?: number;
  totalStudents?: number;
}

export class UpdateAttendanceDto {
  @IsBoolean()
  @IsOptional()
  present?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;

  studentsPresent?: number;
  totalStudents?: number;
} 