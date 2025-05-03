import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, Matches } from 'class-validator';

export class PaymentDto {
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  notes?: string;
  
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Month should be in format YYYY-MM' })
  month?: string;
} 