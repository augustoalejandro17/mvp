import {
  IsNotEmpty,
  IsMongoId,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '../schemas/subscription.schema';

export class CreateSubscriptionDto {
  @IsNotEmpty()
  @IsMongoId()
  plan: string;

  @IsNotEmpty()
  @IsMongoId()
  school: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
