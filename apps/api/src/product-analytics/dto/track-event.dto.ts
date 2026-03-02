import { IsObject, IsOptional, IsString } from 'class-validator';

export class TrackEventDto {
  @IsString()
  event: string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
