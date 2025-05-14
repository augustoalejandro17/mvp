import { PartialType } from '@nestjs/mapped-types';
import { CreateSubscriptionDto } from './create-subscription.dto';
import { IsOptional, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ExtraResourcesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  extraUsers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraStorageGb?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraStreamingMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraCoursesPerUser?: number;
}

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {
  @IsOptional()
  @ValidateNested()
  @Type(() => ExtraResourcesDto)
  approvedExtraResources?: ExtraResourcesDto;
} 