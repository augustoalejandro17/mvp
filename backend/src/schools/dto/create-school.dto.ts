import { IsString, IsOptional, IsUrl, MinLength, IsNotEmpty } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres' })
  description: string;

  @IsUrl({}, { message: 'Debe proporcionar una URL válida para el logo' })
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUrl({}, { message: 'Debe proporcionar una URL válida para el sitio web' })
  @IsOptional()
  website?: string;

  @IsOptional()
  isPublic?: boolean;
} 