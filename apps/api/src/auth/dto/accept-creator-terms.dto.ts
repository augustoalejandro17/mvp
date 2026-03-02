import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AcceptCreatorTermsDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  version?: string;
}
