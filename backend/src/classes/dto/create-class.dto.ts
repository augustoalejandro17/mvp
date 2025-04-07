import { IsString, IsUrl, MinLength, IsNotEmpty, IsMongoId, IsOptional, IsNumber } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  description: string;

  @IsUrl({}, { message: 'Debe proporcionar una URL válida para el video' })
  @IsNotEmpty({ message: 'La URL del video es obligatoria' })
  videoUrl: string;

  @IsMongoId({ message: 'El ID del curso debe ser un ID válido' })
  @IsNotEmpty({ message: 'El ID del curso es obligatorio' })
  courseId: string;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsOptional()
  isPublic?: boolean;
} 