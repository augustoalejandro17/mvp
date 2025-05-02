import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../../auth/enums/user-role.enum';

export class ChangeRoleDto {
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;
} 