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
import { CreateUserReportDto } from './dto/create-user-report.dto';
import { UpdateUserReportStatusDto } from './dto/update-user-report-status.dto';
import { UserReportsService } from './user-reports.service';
import { UserReportStatus } from './schemas/user-report.schema';

@Controller('user-reports')
export class UserReportsController {
  constructor(private readonly userReportsService: UserReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReport(@Req() req: Request, @Body() dto: CreateUserReportDto) {
    const reporterId = req.user['sub'] || req.user['_id'];
    const report = await this.userReportsService.createReport(reporterId, dto);

    return {
      success: true,
      message: 'Denuncia enviada. Nuestro equipo la revisará pronto.',
      report,
    };
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async getMyReports(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const reporterId = req.user['sub'] || req.user['_id'];
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const { reports, total } = await this.userReportsService.getMyReports(
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

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SCHOOL_OWNER)
  async getAllReports(
    @Query('status') status?: UserReportStatus,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const { reports, total } = await this.userReportsService.getAllReports({
      status,
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

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SCHOOL_OWNER)
  async updateReportStatus(
    @Req() req: Request,
    @Param('id') reportId: string,
    @Body() dto: UpdateUserReportStatusDto,
  ) {
    const reviewerId = req.user['sub'] || req.user['_id'];
    const report = await this.userReportsService.updateReportStatus(
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
