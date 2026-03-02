import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsUrl,
  Min,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BadgeType,
  BadgeRarity,
  BadgeRequirement,
} from '../schemas/badge.schema';

export class BadgeRequirementDto implements BadgeRequirement {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class CreateBadgeDto {
  @IsString()
  @IsNotEmpty({ message: 'Badge name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Badge description is required' })
  description: string;

  @IsUrl({}, { message: 'Invalid icon URL' })
  iconUrl: string;

  @IsEnum(BadgeType, { message: 'Invalid badge type' })
  type: BadgeType;

  @IsEnum(BadgeRarity, { message: 'Invalid badge rarity' })
  @IsOptional()
  rarity?: BadgeRarity;

  @IsNumber()
  @Min(0, { message: 'Points required must be non-negative' })
  pointsRequired: number;

  @IsNumber()
  @Min(0, { message: 'Points reward must be non-negative' })
  pointsReward: number;

  @IsObject()
  @ValidateNested()
  @Type(() => BadgeRequirementDto)
  requirements: BadgeRequirementDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsOptional()
  isSecret?: boolean;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;
}

export class UpdateBadgeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl({}, { message: 'Invalid icon URL' })
  @IsOptional()
  iconUrl?: string;

  @IsEnum(BadgeType, { message: 'Invalid badge type' })
  @IsOptional()
  type?: BadgeType;

  @IsEnum(BadgeRarity, { message: 'Invalid badge rarity' })
  @IsOptional()
  rarity?: BadgeRarity;

  @IsNumber()
  @Min(0, { message: 'Points required must be non-negative' })
  @IsOptional()
  pointsRequired?: number;

  @IsNumber()
  @Min(0, { message: 'Points reward must be non-negative' })
  @IsOptional()
  pointsReward?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => BadgeRequirementDto)
  @IsOptional()
  requirements?: BadgeRequirementDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsOptional()
  isSecret?: boolean;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validUntil?: string;
}
