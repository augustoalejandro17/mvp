import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAttendanceDto {
  @IsNotEmpty()
  @IsString()
  courseId: string;

  @IsNotEmpty()
  @IsString()
  studentId: string; // ID o nombre del estudiante

  @IsNotEmpty()
  @IsDateString()
  date: Date;

  @IsBoolean()
  present: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isRegistered?: boolean; // True para usuarios registrados, false para no registrados
} 