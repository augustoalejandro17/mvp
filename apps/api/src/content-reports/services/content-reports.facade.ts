import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ContentReportsService } from '../content-reports.service';
import { CreateContentReportDto } from '../dto/create-content-report.dto';
import { UpdateContentReportStatusDto } from '../dto/update-content-report-status.dto';
import {
  ReportContentType,
  ReportStatus,
} from '../schemas/content-report.schema';

@Injectable()
export class ContentReportsFacade {
  constructor(
    private readonly contentReportsService: ContentReportsService,
  ) {}

  private parsePagination(
    page: string,
    limit: string,
  ): { pageNum: number; limitNum: number } {
    const pageNum = Number.parseInt(page, 10);
    const limitNum = Number.parseInt(limit, 10);

    if (!Number.isInteger(pageNum) || pageNum < 1) {
      throw new BadRequestException('page debe ser un entero >= 1');
    }

    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('limit debe ser un entero entre 1 y 100');
    }

    return { pageNum, limitNum };
  }

  private getUserId(req: Request): string {
    return String(req.user['sub'] || req.user['_id']);
  }

  async createReport(req: Request, dto: CreateContentReportDto) {
    const reporterId = this.getUserId(req);
    const report = await this.contentReportsService.createReport(reporterId, dto);

    return {
      success: true,
      message: 'Denuncia enviada. Nuestro equipo la revisará pronto.',
      report,
    };
  }

  async getMyReports(req: Request, page: string = '1', limit: string = '20') {
    const reporterId = this.getUserId(req);
    const { pageNum, limitNum } = this.parsePagination(page, limit);
    const { reports, total } = await this.contentReportsService.getMyReports(
      reporterId,
      pageNum,
      limitNum,
    );

    return {
      reports,
      total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / Math.max(limitNum, 1)),
    };
  }

  async getAllReports(
    status?: ReportStatus,
    contentType?: ReportContentType,
    page: string = '1',
    limit: string = '20',
  ) {
    const { pageNum, limitNum } = this.parsePagination(page, limit);
    const { reports, total } = await this.contentReportsService.getAllReports({
      status,
      contentType,
      page: pageNum,
      limit: limitNum,
    });

    return {
      reports,
      total,
      currentPage: pageNum,
      totalPages: Math.ceil(total / Math.max(limitNum, 1)),
    };
  }

  async updateReportStatus(
    req: Request,
    reportId: string,
    dto: UpdateContentReportStatusDto,
  ) {
    const reviewerId = this.getUserId(req);
    const report = await this.contentReportsService.updateReportStatus(
      reportId,
      reviewerId,
      dto,
    );

    return {
      success: true,
      message: 'Estado de denuncia actualizado',
      report,
    };
  }
}
