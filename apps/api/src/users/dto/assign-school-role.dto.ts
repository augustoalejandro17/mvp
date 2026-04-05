import { IsIn, IsString } from 'class-validator';

export class AssignSchoolRoleDto {
  @IsString()
  schoolId: string;

  @IsString()
  @IsIn(['teacher', 'administrative', 'student'])
  role: string;
}
