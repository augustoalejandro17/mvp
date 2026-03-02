import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Age must be at least 1' })
  @Max(120, { message: 'Age must be less than 120' })
  age?: number;
}
