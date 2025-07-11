import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
  Logger,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  Permission,
  RequirePermissions,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';

@Controller('attendance')
export class AttendanceController {
  private readonly logger = new Logger(AttendanceController.name);

  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async create(@Body() createAttendanceDto: CreateAttendanceDto, @Req() req) {
    const teacherId = req.user.sub || req.user._id;
    return this.attendanceService.create(createAttendanceDto, teacherId);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async createBulk(@Body() bulkAttendanceDto: BulkAttendanceDto, @Req() req) {
    const teacherId = req.user.sub || req.user._id;
    return this.attendanceService.createBulk(bulkAttendanceDto, teacherId);
  }

  @Get('records')
  @UseGuards(JwtAuthGuard)
  async getAllRecords() {
    return this.attendanceService.findAllRecords();
  }

  @Get('all-records-admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getAllRecordsAdmin() {
    return this.attendanceService.findAllRecords();
  }

  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async findByCourse(
    @Param('courseId') courseId: string,
    @Query('date') dateStr: string,
  ) {
    // Parse the date directly without timezone conversion
    // The frontend should send the correct UTC date string
    const date = dateStr ? new Date(dateStr) : new Date();

    return this.attendanceService.findByCourseAndDate(courseId, date);
  }

  @Get('stats/course/:courseId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getStatsByCourse(@Param('courseId') courseId: string) {
    return this.attendanceService.getStatsByCourse(courseId);
  }

  @Get('stats/student/:courseId/:studentId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getStatsByStudent(
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.attendanceService.getStatsByStudent(courseId, studentId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async update(
    @Param('id') id: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(id, updateAttendanceDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async remove(@Param('id') id: string) {
    return this.attendanceService.remove(id);
  }

  @Post('link-user')
  @UseGuards(JwtAuthGuard)
  async linkUserAttendances(
    @Body() linkData: { unregisteredName: string; userId: string },
  ) {
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

  @Get('course/:courseId/month')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async findByCourseAndMonth(
    @Param('courseId') courseId: string,
    @Query('year') yearStr: string,
    @Query('month') monthStr: string,
    @Query('referenceDate') referenceDateStr: string,
  ) {
    let year: number;
    let month: number;

    // Si se proporciona una fecha de referencia, extraer el año y mes de ella
    if (referenceDateStr) {
      const referenceDate = new Date(referenceDateStr);
      year = referenceDate.getFullYear();
      month = referenceDate.getMonth() + 1; // getMonth() devuelve 0-11
    }
    // De lo contrario, usar los parámetros de año y mes proporcionados
    else if (yearStr && monthStr) {
      year = parseInt(yearStr, 10);
      month = parseInt(monthStr, 10);
    }
    // Si no se proporciona ningún parámetro, usar el mes actual
    else {
      const currentDate = new Date();
      year = currentDate.getFullYear();
      month = currentDate.getMonth() + 1;
    }

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      this.logger.error(`Valores de año (${year}) o mes (${month}) inválidos`);
      throw new Error('Valores de año o mes inválidos');
    }

    return this.attendanceService.findByCourseAndMonth(courseId, year, month);
  }
}
