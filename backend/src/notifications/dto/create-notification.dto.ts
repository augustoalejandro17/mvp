import { IsString, IsNotEmpty, IsEnum, IsOptional, IsMongoId, IsDateString, IsObject } from 'class-validator';
import { NotificationType, NotificationPriority } from '../schemas/notification.schema';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'El mensaje es obligatorio' })
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsMongoId({ message: 'El ID del destinatario debe ser un ID válido' })
  @IsNotEmpty({ message: 'El destinatario es obligatorio' })
  recipient: string;

  @IsMongoId({ message: 'El ID del remitente debe ser un ID válido' })
  @IsOptional()
  sender?: string;

  @IsMongoId({ message: 'El ID del curso debe ser un ID válido' })
  @IsOptional()
  relatedCourse?: string;

  @IsDateString()
  @IsOptional()
  scheduledFor?: string;

  @IsObject()
  @IsOptional()
  metadata?: {
    classStartTime?: Date;
    courseId?: string;
    actionUrl?: string;
    [key: string]: any;
  };
} 