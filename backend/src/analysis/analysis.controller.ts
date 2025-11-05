import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalysisService } from './analysis.service';
import { CreateAnalysisDto, AnalysisResponseDto, AnalysisListResponseDto } from './dto/analysis.dto';

@Controller('analysis')
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('landmarks')
  async createAnalysis(
    @Request() req: any,
    @Body() createAnalysisDto: CreateAnalysisDto,
  ): Promise<AnalysisResponseDto> {
    try {
      const userId = req.user.id;
      return await this.analysisService.createAnalysis(userId, createAnalysisDto);
    } catch (error) {
      throw new HttpException(
        'Failed to process analysis',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getAnalysis(
    @Request() req: any,
    @Param('id') analysisId: string,
  ): Promise<AnalysisResponseDto> {
    const userId = req.user.id;
    const analysis = await this.analysisService.getAnalysis(userId, analysisId);
    
    if (!analysis) {
      throw new HttpException('Analysis not found', HttpStatus.NOT_FOUND);
    }
    
    return analysis;
  }

  @Get()
  async getUserAnalyses(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ): Promise<{
    analyses: AnalysisListResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const userId = req.user.id;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    
    return await this.analysisService.getUserAnalyses(userId, pageNum, limitNum);
  }

  @Get('stats/summary')
  async getAnalysisStats(@Request() req: any): Promise<{
    totalAnalyses: number;
    averageScore: number;
    bestScore: number;
    recentTrend: 'improving' | 'declining' | 'stable';
  }> {
    const userId = req.user.id;
    return await this.analysisService.getAnalysisStats(userId);
  }
}
