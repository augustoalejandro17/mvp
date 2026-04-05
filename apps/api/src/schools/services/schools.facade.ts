import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateSchoolDto } from '../dto/create-school.dto';
import { UserRole } from '../../auth/schemas/user.schema';
import { SchoolsService } from '../schools.service';

@Injectable()
export class SchoolsFacade {
  constructor(private readonly schoolsService: SchoolsService) {}

  private ensureValidSchoolId(id: string): void {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException(`ID de escuela invalido: ${id}`);
    }
  }

  async findPublic() {
    return this.schoolsService.findPublic();
  }

  async findByTeacher(userId: string) {
    return this.schoolsService.findAll(userId, UserRole.TEACHER);
  }

  async findAllForUser(user: any) {
    const userId = user.sub || (user._id ? user._id.toString() : null);
    const userRole = user.role;

    return this.schoolsService.findAll(userId, userRole);
  }

  async findOneForRequest(id: string) {
    this.ensureValidSchoolId(id);
    return this.schoolsService.findOne(id);
  }

  async createForRequest(createSchoolDto: CreateSchoolDto, user: any) {
    return this.schoolsService.create(createSchoolDto, user._id);
  }

  async updateForRequest(id: string, updateSchoolDto: any, user: any) {
    this.ensureValidSchoolId(id);
    return this.schoolsService.update(
      id,
      updateSchoolDto,
      user.sub || user._id,
    );
  }

  async addTeacherForRequest(id: string, teacherId: string, user: any) {
    return this.schoolsService.addTeacher(id, teacherId, user._id);
  }

  async addStudentForRequest(id: string, studentId: string, user: any) {
    return this.schoolsService.addStudent(id, studentId, user._id);
  }

  async removeForRequest(id: string, user: any) {
    const userId = user.sub || user._id?.toString();
    return this.schoolsService.remove(id, userId);
  }

  async getTeachersBySchoolForRequest(id: string) {
    this.ensureValidSchoolId(id);
    return this.schoolsService.findAllTeachersBySchool(id);
  }

  async getUserOwnedSchools(userId: string, requestUser: any) {
    try {
      if (
        requestUser.sub !== userId &&
        requestUser.role !== UserRole.SUPER_ADMIN
      ) {
        throw new UnauthorizedException(
          'No tienes permiso para ver las escuelas de este usuario',
        );
      }

      return this.schoolsService.findSchoolsByOwner(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener escuelas del usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserAdministeredSchools(userId: string, requestUser: any) {
    try {
      if (
        requestUser.sub !== userId &&
        requestUser.role !== UserRole.SUPER_ADMIN
      ) {
        throw new UnauthorizedException(
          'No tienes permiso para ver las escuelas de este usuario',
        );
      }

      return this.schoolsService.findSchoolsByAdministrator(userId);
    } catch (error) {
      throw new HttpException(
        error.message ||
          'Error al obtener escuelas administradas por el usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async assignOwner(schoolId: string, userId: string) {
    return this.schoolsService.assignOwner(schoolId, userId);
  }

  async fixExtraSeats() {
    return this.schoolsService.fixExtraSeats();
  }
}
