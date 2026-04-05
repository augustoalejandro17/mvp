import { IsEmail, IsOptional, IsString } from 'class-validator';

export class RegisterUnregisteredUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  additionalInfo?: {
    [key: string]: any;
  };
}
