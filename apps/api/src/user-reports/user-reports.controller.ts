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
import { UserReportStatus } from './schemas/user-report.schema';
import { UserReportsFacade } from './services/user-reports.facade';

@Controller('user-reports')
export class UserReportsController {
  constructor(
    private readonly userReportsFacade: UserReportsFacade,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReport(@Req() req: Request, @Body() dto: CreateUserReportDto) {
    return this.userReportsFacade.createReport(req, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async getMyReports(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.userReportsFacade.getMyReports(req, page, limit);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SCHOOL_OWNER)
  async getAllReports(
    @Query('status') status?: UserReportStatus,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.userReportsFacade.getAllReports(
      status,
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
    @Body() dto: UpdateUserReportStatusDto,
  ) {
    return this.userReportsFacade.updateReportStatus(
      req,
      reportId,
      dto,
    );
  }
}
