import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AttendanceService } from '../attendance.service';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';

@Injectable()
export class AttendanceFacade {
  private readonly logger = new Logger(AttendanceFacade.name);

  constructor(private readonly attendanceService: AttendanceService) {}

  private getTeacherId(req: any): string {
    return String(req.user.sub || req.user._id);
  }

  private parseDate(dateStr?: string): Date {
    const date = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        'El parámetro date no tiene formato válido',
      );
    }
    return date;
  }

  private parseYearMonth(
    yearStr?: string,
    monthStr?: string,
    referenceDateStr?: string,
  ) {
    let year: number;
    let month: number;

    if (referenceDateStr) {
      const referenceDate = new Date(referenceDateStr);
      if (Number.isNaN(referenceDate.getTime())) {
        throw new BadRequestException(
          'El parámetro referenceDate no tiene formato válido',
        );
      }
      year = referenceDate.getFullYear();
      month = referenceDate.getMonth() + 1;
    } else if (yearStr && monthStr) {
      year = Number.parseInt(yearStr, 10);
      month = Number.parseInt(monthStr, 10);
    } else {
      const currentDate = new Date();
      year = currentDate.getFullYear();
      month = currentDate.getMonth() + 1;
    }

    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      this.logger.error(`Valores de año (${year}) o mes (${month}) inválidos`);
      throw new BadRequestException('Valores de año o mes inválidos');
    }

    return { year, month };
  }

  create(createAttendanceDto: CreateAttendanceDto, req: any) {
    return this.attendanceService.create(
      createAttendanceDto,
      this.getTeacherId(req),
    );
  }

  createBulk(bulkAttendanceDto: BulkAttendanceDto, req: any) {
    return this.attendanceService.createBulk(
      bulkAttendanceDto,
      this.getTeacherId(req),
    );
  }

  findByCourse(courseId: string, dateStr?: string) {
    return this.attendanceService.findByCourseAndDate(
      courseId,
      this.parseDate(dateStr),
    );
  }

  async linkUserAttendances(linkData: {
    unregisteredName: string;
    userId: string;
  }) {
    const updatedCount =
      await this.attendanceService.linkAttendancesToRegisteredUser(
        linkData.unregisteredName,
        linkData.userId,
      );

    return {
      success: true,
      message: `Se vincularon ${updatedCount} registros de asistencia al usuario`,
      updatedCount,
    };
  }

  findByCourseAndMonth(
    courseId: string,
    yearStr?: string,
    monthStr?: string,
    referenceDateStr?: string,
  ) {
    const { year, month } = this.parseYearMonth(
      yearStr,
      monthStr,
      referenceDateStr,
    );
    return this.attendanceService.findByCourseAndMonth(courseId, year, month);
  }

  update(id: string, updateAttendanceDto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, updateAttendanceDto);
  }

  getAllRecords() {
    return this.attendanceService.findAllRecords();
  }

  getStatsByCourse(courseId: string) {
    return this.attendanceService.getStatsByCourse(courseId);
  }

  getStatsByStudent(courseId: string, studentId: string) {
    return this.attendanceService.getStatsByStudent(courseId, studentId);
  }

  findOne(id: string) {
    return this.attendanceService.findOne(id);
  }

  remove(id: string) {
    return this.attendanceService.remove(id);
  }
}
