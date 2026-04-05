import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ReportsService } from '../reports.service';

type ReportFormat = 'csv' | 'excel';

@Injectable()
export class ReportsFacade {
  private readonly logger = new Logger(ReportsFacade.name);

  constructor(private readonly reportsService: ReportsService) {}

  private getUserContext(req: Request) {
    const authUser = req.user as Record<string, unknown>;
    return {
      userId: String(authUser.sub || authUser._id),
      userRole: String(authUser.role),
    };
  }

  private resolveReportPeriod(month?: string, year?: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const reportMonth = month ? Number.parseInt(month, 10) : now.getMonth() + 1;
    const reportYear = year ? Number.parseInt(year, 10) : currentYear;

    if (!Number.isInteger(reportMonth) || reportMonth < 1 || reportMonth > 12) {
      throw new BadRequestException('Month must be between 1 and 12');
    }

    if (
      !Number.isInteger(reportYear) ||
      reportYear < 2020 ||
      reportYear > currentYear + 1
    ) {
      throw new BadRequestException('Invalid year provided');
    }

    return { reportMonth, reportYear };
  }

  private validateExportFormat(format: ReportFormat) {
    if (!['csv', 'excel'].includes(format)) {
      throw new BadRequestException('format must be csv or excel');
    }
  }

  async getMonthlyAttendanceReport(
    req: Request,
    schoolId?: string,
    month?: string,
    year?: string,
    courseId?: string,
  ) {
    const { userId, userRole } = this.getUserContext(req);
    const { reportMonth, reportYear } = this.resolveReportPeriod(month, year);

    this.logger.log(
      `Monthly attendance report requested by user ${userId} (${userRole})`,
    );

    return this.reportsService.getMonthlyAttendanceReport({
      userId,
      userRole,
      schoolId,
      month: reportMonth,
      year: reportYear,
      courseId,
    });
  }

  async exportMonthlyAttendanceReport(
    req: Request,
    schoolId?: string,
    month?: string,
    year?: string,
    courseId?: string,
    format: ReportFormat = 'csv',
  ) {
    const { userId, userRole } = this.getUserContext(req);
    const { reportMonth, reportYear } = this.resolveReportPeriod(month, year);

    this.validateExportFormat(format);
    this.logger.log(
      `Attendance export requested by user ${userId} in ${format} format`,
    );

    return this.reportsService.exportMonthlyAttendanceReport({
      userId,
      userRole,
      schoolId,
      month: reportMonth,
      year: reportYear,
      courseId,
      format,
    });
  }

  async getMonthlyPaymentReport(
    req: Request,
    schoolId?: string,
    month?: string,
    year?: string,
    courseId?: string,
  ) {
    const { userId, userRole } = this.getUserContext(req);
    const { reportMonth, reportYear } = this.resolveReportPeriod(month, year);

    this.logger.log(
      `Monthly payment report requested by user ${userId} (${userRole})`,
    );

    return this.reportsService.getMonthlyPaymentReport({
      userId,
      userRole,
      schoolId,
      month: reportMonth,
      year: reportYear,
      courseId,
    });
  }

  async exportMonthlyPaymentReport(
    req: Request,
    schoolId?: string,
    month?: string,
    year?: string,
    courseId?: string,
    format: ReportFormat = 'csv',
  ) {
    const { userId, userRole } = this.getUserContext(req);
    const { reportMonth, reportYear } = this.resolveReportPeriod(month, year);

    this.validateExportFormat(format);
    this.logger.log(
      `Payment export requested by user ${userId} in ${format} format`,
    );

    return this.reportsService.exportMonthlyPaymentReport({
      userId,
      userRole,
      schoolId,
      month: reportMonth,
      year: reportYear,
      courseId,
      format,
    });
  }
}
