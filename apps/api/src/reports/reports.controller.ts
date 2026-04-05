import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, Permission } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import {
  MonthlyAttendanceReport,
  MonthlyPaymentReport,
} from './types/report.types';
import { ReportsFacade } from './services/reports.facade';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsFacade: ReportsFacade,
  ) {}

  @Get('attendance/monthly')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getMonthlyAttendanceReport(
    @Query('schoolId') schoolId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('courseId') courseId?: string,
    @Req() req?: any,
  ): Promise<MonthlyAttendanceReport> {
    return this.reportsFacade.getMonthlyAttendanceReport(
      req,
      schoolId,
      month,
      year,
      courseId,
    );
  }

  @Get('attendance/export')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async exportMonthlyAttendanceReport(
    @Query('schoolId') schoolId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('courseId') courseId?: string,
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Req() req?: any,
    @Res() res?: any,
  ): Promise<void> {
    const result = await this.reportsFacade.exportMonthlyAttendanceReport(
      req,
      schoolId,
      month,
      year,
      courseId,
      format,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }

  @Get('payments/monthly')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_COURSE)
  async getMonthlyPaymentReport(
    @Query('schoolId') schoolId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('courseId') courseId?: string,
    @Req() req?: any,
  ): Promise<MonthlyPaymentReport> {
    return this.reportsFacade.getMonthlyPaymentReport(
      req,
      schoolId,
      month,
      year,
      courseId,
    );
  }

  @Get('payments/export')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_COURSE)
  async exportMonthlyPaymentReport(
    @Query('schoolId') schoolId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('courseId') courseId?: string,
    @Query('format') format: 'csv' | 'excel' = 'csv',
    @Req() req?: any,
    @Res() res?: any,
  ): Promise<void> {
    const result = await this.reportsFacade.exportMonthlyPaymentReport(
      req,
      schoolId,
      month,
      year,
      courseId,
      format,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.data);
  }
}
