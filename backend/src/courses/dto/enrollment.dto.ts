import { IsBoolean, IsMongoId, IsOptional, IsString } from 'class-validator';

export class EnrollmentDto {
  @IsMongoId()
  studentId: string;

  @IsBoolean()
  @IsOptional()
  paymentStatus?: boolean;

  @IsString()
  @IsOptional()
  paymentNotes?: string;
}

export class UpdateEnrollmentDto {
  @IsBoolean()
  @IsOptional()
  paymentStatus?: boolean;

  @IsString()
  @IsOptional()
  paymentNotes?: string;
} 