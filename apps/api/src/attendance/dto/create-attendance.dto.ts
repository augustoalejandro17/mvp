import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateAttendanceDto {
  @IsNotEmpty()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsString() // Puede ser ObjectId o un nombre (si es no registrado, pero ahora se espera ObjectId)
  studentId: string;

  @IsNotEmpty()
  @IsDateString()
  date: string; // Fecha de la clase (YYYY-MM-DD), la hora se ignora para la búsqueda y se usa current para el registro

  @IsNotEmpty()
  @IsBoolean()
  present: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  // Eliminamos isRegistered ya que studentId siempre será un ObjectId de un User
  // @IsOptional()
  // @IsBoolean()
  // isRegistered?: boolean;
}
