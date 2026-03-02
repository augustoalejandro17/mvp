import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsMongoId,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isPublic?: boolean;
}
