import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsMongoId,
  IsArray,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreatePlaylistDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsMongoId({ message: 'El ID del curso debe ser válido' })
  course: string;

  @IsArray()
  @IsMongoId({ each: true, message: 'Los IDs de las clases deben ser válidos' })
  @IsOptional()
  classes?: string[];

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class UpdatePlaylistDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsMongoId({ each: true, message: 'Los IDs de las clases deben ser válidos' })
  @IsOptional()
  classes?: string[];

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class AddClassToPlaylistDto {
  @IsMongoId({ message: 'El ID de la clase debe ser válido' })
  classId: string;
}

export class RemoveClassFromPlaylistDto {
  @IsMongoId({ message: 'El ID de la clase debe ser válido' })
  classId: string;
}
