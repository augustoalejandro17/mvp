import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateSubmissionAnnotationDto {
  @IsOptional()
  @IsInt({ message: 'timestampSeconds debe ser un entero' })
  @Min(0, { message: 'timestampSeconds no puede ser negativo' })
  @Type(() => Number)
  timestampSeconds?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El comentario no puede estar vacío' })
  @MaxLength(1500, {
    message: 'El comentario no puede tener más de 1500 caracteres',
  })
  text?: string;
}
