import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsEnum(UserRole)
  role: UserRole;
} 