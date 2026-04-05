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
} from '@nestjs/common';
import { AttendanceFacade } from './services/attendance.facade';
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
  constructor(private readonly attendanceFacade: AttendanceFacade) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async create(@Body() createAttendanceDto: CreateAttendanceDto, @Req() req) {
    return this.attendanceFacade.create(createAttendanceDto, req);
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async createBulk(@Body() bulkAttendanceDto: BulkAttendanceDto, @Req() req) {
    return this.attendanceFacade.createBulk(bulkAttendanceDto, req);
  }

  @Get('records')
  @UseGuards(JwtAuthGuard)
  async getAllRecords() {
    return this.attendanceFacade.getAllRecords();
  }

  @Get('all-records-admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getAllRecordsAdmin() {
    return this.attendanceFacade.getAllRecords();
  }

  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async findByCourse(
    @Param('courseId') courseId: string,
    @Query('date') dateStr: string,
  ) {
    return this.attendanceFacade.findByCourse(courseId, dateStr);
  }

  @Get('stats/course/:courseId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getStatsByCourse(@Param('courseId') courseId: string) {
    return this.attendanceFacade.getStatsByCourse(courseId);
  }

  @Get('stats/student/:courseId/:studentId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getStatsByStudent(
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.attendanceFacade.getStatsByStudent(courseId, studentId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.attendanceFacade.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async update(
    @Param('id') id: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendanceFacade.update(id, updateAttendanceDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async remove(@Param('id') id: string) {
    return this.attendanceFacade.remove(id);
  }

  @Post('link-user')
  @UseGuards(JwtAuthGuard)
  async linkUserAttendances(
    @Body() linkData: { unregisteredName: string; userId: string },
  ) {
    return this.attendanceFacade.linkUserAttendances(linkData);
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
    return this.attendanceFacade.findByCourseAndMonth(
      courseId,
      yearStr,
      monthStr,
      referenceDateStr,
    );
  }
}
