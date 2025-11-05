import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CoachService } from './coach.service';
import {
  CreateDrillDto,
  UpdateDrillDto,
  AttemptInputDto,
  DrillResponseDto,
  DrillListResponseDto,
  AttemptResponseDto,
  AttemptListResponseDto,
} from './dto/coach.dto';

@Controller('coach')
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private readonly coachService: CoachService) {}

  @Post('drills')
  async createDrill(
    @Request() req: any,
    @Body() createDrillDto: CreateDrillDto,
  ): Promise<DrillResponseDto> {
    try {
      const teacherId = req.user.id;
      return await this.coachService.createDrill(teacherId, createDrillDto);
    } catch (error) {
      throw new HttpException(
        'Failed to create drill',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('drills/:id')
  async updateDrill(
    @Request() req: any,
    @Param('id') drillId: string,
    @Body() updateDrillDto: UpdateDrillDto,
  ): Promise<DrillResponseDto> {
    const teacherId = req.user.id;
    return await this.coachService.updateDrill(teacherId, drillId, updateDrillDto);
  }

  @Get('drills')
  async getTeacherDrills(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ): Promise<{
    drills: DrillListResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const teacherId = req.user.id;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    
    return await this.coachService.getTeacherDrills(teacherId, pageNum, limitNum);
  }

  @Get('drills/:id')
  async getDrill(@Param('id') drillId: string): Promise<DrillResponseDto> {
    return await this.coachService.getDrill(drillId);
  }

  @Post('drills/:id/attempts')
  async createAttempt(
    @Request() req: any,
    @Param('id') drillId: string,
    @Body() attemptInput: AttemptInputDto,
  ): Promise<AttemptResponseDto> {
    try {
      const studentId = req.user.id;
      return await this.coachService.createAttempt(studentId, drillId, attemptInput);
    } catch (error) {
      throw new HttpException(
        'Failed to process attempt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('drills/:id/attempts')
  async getDrillAttempts(
    @Request() req: any,
    @Param('id') drillId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ): Promise<{
    attempts: AttemptListResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const userId = req.user.id;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    
    return await this.coachService.getDrillAttempts(drillId, userId, pageNum, limitNum);
  }

  @Get('attempts/:id')
  async getAttempt(
    @Request() req: any,
    @Param('id') attemptId: string,
  ): Promise<AttemptResponseDto> {
    const userId = req.user.id;
    return await this.coachService.getAttempt(attemptId, userId);
  }
}
