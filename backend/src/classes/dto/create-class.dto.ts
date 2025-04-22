import { IsString, MinLength, IsNotEmpty, IsMongoId, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  description: string;

  @IsMongoId({ message: 'El ID del curso debe ser un ID válido' })
  @IsNotEmpty({ message: 'El ID del curso es obligatorio' })
  courseId: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @Type(() => Boolean)
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isPublic?: boolean;
} 