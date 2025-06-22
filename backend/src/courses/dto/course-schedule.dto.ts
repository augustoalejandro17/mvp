import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, Max, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from '../schemas/course-schedule.schema';

export class ScheduleTimeDto {
  @IsEnum(DayOfWeek, { message: 'Día de la semana inválido' })
  dayOfWeek: DayOfWeek;

  @IsString()
  @IsNotEmpty({ message: 'La hora de inicio es obligatoria' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Formato de hora inválido. Use HH:MM (formato 24 horas)' })
  startTime: string;

  @IsString()
  @IsNotEmpty({ message: 'La hora de fin es obligatoria' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Formato de hora inválido. Use HH:MM (formato 24 horas)' })
  endTime: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class CreateCourseScheduleDto {
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

export class UpdateCourseScheduleDto extends CreateCourseScheduleDto {} 