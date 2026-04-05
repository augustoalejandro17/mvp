import { IsNumber, IsString, Min } from 'class-validator';

export class SetOwnerSeatQuotaDto {
  @IsString()
  schoolId: string;

  @IsNumber()
  @Min(0)
  totalSeats: number;
}
