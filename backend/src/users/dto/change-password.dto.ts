import { IsNotEmpty, IsString, MinLength, Matches, IsOptional } from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
  })
  newPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
  })
  password?: string;
} 