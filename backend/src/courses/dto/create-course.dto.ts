import { IsString, IsOptional, IsUrl, MinLength, IsNotEmpty, IsMongoId } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  description: string;

  @IsUrl({}, { message: 'Debe proporcionar una URL válida para la imagen de portada' })
  @IsOptional()
  coverImageUrl?: string;

  @IsMongoId({ message: 'El ID de la escuela debe ser un ID válido' })
  @IsNotEmpty({ message: 'El ID de la escuela es obligatorio' })
  schoolId: string;

  @IsOptional()
  isPublic?: boolean;
} 