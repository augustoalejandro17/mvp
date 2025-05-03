import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../../auth/schemas/user.schema';

export class ChangeRoleDto {
  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;
} 