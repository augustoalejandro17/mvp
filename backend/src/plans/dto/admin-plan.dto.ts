import { IsEnum, IsNumber, IsOptional, Min, IsMongoId } from 'class-validator';
import { PlanType } from '../constants/plan-config.constants';

export class AssignPlanDto {
  @IsMongoId()
  planId: string;
}

export class GrantExtraResourcesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraSeats?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraStorageGB?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraStreamingHours?: number;
} 