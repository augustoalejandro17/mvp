import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsMongoId,
  Min,
} from 'class-validator';

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
  order?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
