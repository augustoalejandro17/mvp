import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateClassSubmissionDto {
  @IsMongoId({ message: 'El ID de la clase debe ser válido' })
  @IsNotEmpty({ message: 'El ID de la clase es obligatorio' })
  classId: string;
}
