import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsBoolean,
  Min,
  IsArray,
} from 'class-validator';
import { PlanType } from '../schemas/plan.schema';

export class CreatePlanDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(PlanType)
  type: PlanType;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  maxUsers: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  maxStorageGb: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  maxStreamingMinutesPerMonth: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  maxCoursesPerUser: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  monthlyPrice: number;

  @IsBoolean()
  isDefault?: boolean;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  extraUserPrice: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  extraStorageGbPrice: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  extraStreamingMinutesPrice: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  extraCoursePerUserPrice: number;

  @IsNotEmpty()
  @IsNumber()
  price: number;

  @IsArray()
  @IsString({ each: true })
  features: string[];
}
