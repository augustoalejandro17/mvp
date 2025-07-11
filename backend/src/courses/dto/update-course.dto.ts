import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from './create-course.dto';
import {
  IsString,
  IsOptional,
  IsUrl,
  MinLength,
  IsMongoId,
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsEnum,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ScheduleTimeDto } from './course-schedule.dto';
import { UserRole } from '../../auth/schemas/user.schema';

export class UpdateCourseDto {
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres' })
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(10, {
    message: 'La descripción debe tener al menos 10 caracteres',
  })
  description?: string;

  @IsUrl(
    {},
    { message: 'Debe proporcionar una URL válida para la imagen de portada' },
  )
  @IsOptional()
  coverImageUrl?: string;

  @IsMongoId({ message: 'El ID de la escuela debe ser un ID válido' })
  @IsOptional()
  schoolId?: string;

  @IsMongoId({ message: 'El ID del profesor principal debe ser un ID válido' })
  @IsOptional()
  teacher?: string;

  @IsOptional()
  @IsArray({ message: 'Las categorías deben ser un arreglo' })
  @ArrayMaxSize(5, {
    message: 'Un curso puede tener un máximo de 5 categorías',
  })
  @IsMongoId({
    each: true,
    message: 'Cada ID de categoría debe ser un ID válido',
  })
  categories?: string[];

  @IsOptional()
  @IsArray({ message: 'Los profesores adicionales deben ser un arreglo' })
  @ArrayMaxSize(5, {
    message: 'Un curso puede tener un máximo de 5 profesores',
  })
  @IsMongoId({
    each: true,
    message: 'Cada ID de profesor debe ser un ID válido',
  })
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

  // Schedule fields
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleTimeDto)
  scheduleTimes?: ScheduleTimeDto[];

  @IsOptional()
  @IsBoolean()
  enableNotifications?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(30)
  notificationMinutes?: number;
}
