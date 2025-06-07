import { IsString, IsOptional, IsUrl, MinLength, IsNotEmpty, IsMongoId, IsArray, ArrayMaxSize, ArrayMinSize, ValidateIf, IsBoolean, IsNumber, Min, Max } from 'class-validator';

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

  @IsMongoId({ message: 'El ID del profesor principal debe ser un ID válido' })
  @IsNotEmpty({ message: 'El profesor principal es obligatorio' })
  teacher: string;

  @IsOptional()
  @IsMongoId({ message: 'El ID de la categoría debe ser un ID válido' })
  category?: string;

  @IsOptional()
  @IsArray({ message: 'Los profesores adicionales deben ser un arreglo' })
  @ArrayMaxSize(5, { message: 'Un curso puede tener un máximo de 5 profesores' })
  @IsMongoId({ each: true, message: 'Cada ID de profesor debe ser un ID válido' })
  teachers?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
  
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'El orden de promoción debe ser un número positivo' })
  @Max(999, { message: 'El orden de promoción no puede ser mayor a 999' })
  promotionOrder?: number = 999; // Valor alto por defecto (menos prioridad)
  
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false; // No destacado por defecto

  @IsOptional()
  @IsString()
  readonly sede?: string;
} 