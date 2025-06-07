import { IsString, IsOptional, IsUrl, MinLength, IsNotEmpty, IsMongoId, IsArray, ArrayMaxSize, IsBoolean, IsNumber, Min, Max, ValidateIf } from 'class-validator';

export class UpdateCourseDto {
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  description?: string;

  @IsUrl({}, { message: 'Debe proporcionar una URL válida para la imagen de portada' })
  @IsOptional()
  coverImageUrl?: string;

  @IsMongoId({ message: 'El ID de la escuela debe ser un ID válido' })
  @IsOptional()
  schoolId?: string;

  @IsMongoId({ message: 'El ID del profesor principal debe ser un ID válido' })
  @IsOptional()
  teacher?: string;

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
  promotionOrder?: number;
  
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsString()
  readonly sede?: string;
} 