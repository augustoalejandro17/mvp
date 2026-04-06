import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateSubmissionAnnotationDto {
  @IsInt({ message: 'timestampSeconds debe ser un entero' })
  @Min(0, { message: 'timestampSeconds no puede ser negativo' })
  @Type(() => Number)
  timestampSeconds: number;

  @IsString()
  @IsNotEmpty({ message: 'El comentario es obligatorio' })
  @MaxLength(1500, {
    message: 'El comentario no puede tener más de 1500 caracteres',
  })
  text: string;
}
