import { IsBoolean, IsMongoId, IsString, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEnrollmentDto {
  @IsBoolean()
  @IsOptional()
  paymentStatus?: boolean;

  @IsString()
  @IsOptional()
  paymentNotes?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  lastPaymentDate?: Date;

  @IsMongoId()
  @IsOptional()
  updatedBy?: string;
} 