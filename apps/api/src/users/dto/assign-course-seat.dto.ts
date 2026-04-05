import { IsOptional, IsString } from 'class-validator';

export class AssignCourseSeatDto {
  @IsString()
  schoolId: string;

  @IsString()
  courseId: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
