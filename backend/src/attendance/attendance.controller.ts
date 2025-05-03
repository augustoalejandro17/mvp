import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req, Logger } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permission, RequirePermissions, PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('attendance')
export class AttendanceController {
  private readonly logger = new Logger(AttendanceController.name);

  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async create(@Body() createAttendanceDto: CreateAttendanceDto, @Req() req) {
    this.logger.log(`Registrando asistencia para estudiante: ${createAttendanceDto.studentId} en curso: ${createAttendanceDto.courseId}`);
    const teacherId = req.user.sub || req.user._id;
    return this.attendanceService.create(createAttendanceDto, teacherId);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async createBulk(@Body() bulkAttendanceDto: BulkAttendanceDto, @Req() req) {
    this.logger.log(`Registrando asistencia masiva para ${bulkAttendanceDto.attendances.length} estudiantes en curso: ${bulkAttendanceDto.courseId}`);
    const teacherId = req.user.sub || req.user._id;
    return this.attendanceService.createBulk(bulkAttendanceDto, teacherId);
  }

  @Get('records')
  @UseGuards(JwtAuthGuard)
  async getAllRecords() {
    this.logger.log('Obteniendo todos los registros de asistencia');
    return this.attendanceService.findAllRecords();
  }

  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async findByCourse(
    @Param('courseId') courseId: string,
    @Query('date') dateStr: string
  ) {
    // Si no se proporciona fecha, usar la fecha actual
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
    @Param('studentId') studentId: string
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
    @Body() updateAttendanceDto: UpdateAttendanceDto
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
  async linkUserAttendances(@Body() linkData: { unregisteredName: string; userId: string }) {
    this.logger.log(`Vinculando asistencias de "${linkData.unregisteredName}" al usuario ${linkData.userId}`);
    const updatedCount = await this.attendanceService.linkAttendancesToRegisteredUser(
      linkData.unregisteredName,
      linkData.userId
    );
    return {
      success: true,
      message: `Se vincularon ${updatedCount} registros de asistencia al usuario`,
      updatedCount
    };
  }
} 