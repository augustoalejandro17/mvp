import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/schemas/user.schema';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { UpdateContentReportStatusDto } from './dto/update-content-report-status.dto';
import {
  ReportContentType,
  ReportStatus,
} from './schemas/content-report.schema';
import { ContentReportsFacade } from './services/content-reports.facade';

@Controller('content-reports')
export class ContentReportsController {
  constructor(
    private readonly contentReportsFacade: ContentReportsFacade,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReport(@Req() req: Request, @Body() dto: CreateContentReportDto) {
    return this.contentReportsFacade.createReport(req, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async getMyReports(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.contentReportsFacade.getMyReports(req, page, limit);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SCHOOL_OWNER)
  async getAllReports(
    @Query('status') status?: ReportStatus,
    @Query('contentType') contentType?: ReportContentType,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.contentReportsFacade.getAllReports(
      status,
      contentType,
      page,
      limit,
    );
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SCHOOL_OWNER)
  async updateReportStatus(
    @Req() req: Request,
    @Param('id') reportId: string,
    @Body() dto: UpdateContentReportStatusDto,
  ) {
    return this.contentReportsFacade.updateReportStatus(
      req,
      reportId,
      dto,
    );
  }
}
