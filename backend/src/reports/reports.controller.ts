import { Controller, Get, Query, UseGuards, Req, Logger, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, Permission } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { MonthlyAttendanceReport, ExportResult } from './types/report.types';

@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance/monthly')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getMonthlyAttendanceReport(
    @Query('schoolId') schoolId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('courseId') courseId?: string,
    @Req() req?: any
  ): Promise<MonthlyAttendanceReport> {
    try {
      const userId = req.user.sub || req.user._id;
      const userRole = req.user.role;

      this.logger.log(`Monthly attendance report requested by user ${userId} (${userRole})`);

      // Validate month and year
      const reportMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const reportYear = year ? parseInt(year) : new Date().getFullYear();

      if (reportMonth < 1 || reportMonth > 12) {
        throw new BadRequestException('Month must be between 1 and 12');
      }

      if (reportYear < 2020 || reportYear > new Date().getFullYear() + 1) {
        throw new BadRequestException('Invalid year provided');
      }

      return await this.reportsService.getMonthlyAttendanceReport({
        userId,
        userRole,
        schoolId,
        month: reportMonth,
        year: reportYear,
        courseId
      });

    } catch (error) {
      this.logger.error(`Error generating monthly attendance report: ${error.message}`, error.stack);
      throw error;
    }
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
    @Req() req?: any
  ): Promise<ExportResult> {
    try {
      const userId = req.user.sub || req.user._id;
      const userRole = req.user.role;

      this.logger.log(`Attendance export requested by user ${userId} in ${format} format`);

      const reportMonth = month ? parseInt(month) : new Date().getMonth() + 1;
      const reportYear = year ? parseInt(year) : new Date().getFullYear();

      return await this.reportsService.exportMonthlyAttendanceReport({
        userId,
        userRole,
        schoolId,
        month: reportMonth,
        year: reportYear,
        courseId,
        format
      });

    } catch (error) {
      this.logger.error(`Error exporting attendance report: ${error.message}`, error.stack);
      throw error;
    }
  }
} 