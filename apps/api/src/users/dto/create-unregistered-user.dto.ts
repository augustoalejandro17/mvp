import { IsOptional, IsString } from 'class-validator';

export class CreateUnregisteredUserDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  role?: string;
}
