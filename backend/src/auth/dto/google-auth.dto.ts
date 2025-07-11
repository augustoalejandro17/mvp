import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsOptional()
  @IsString()
  accessToken?: string;
}

export class GoogleCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}

export class LinkGoogleAccountDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsOptional()
  @IsBoolean()
  forceLink?: boolean; // Force link even if email already exists
}
