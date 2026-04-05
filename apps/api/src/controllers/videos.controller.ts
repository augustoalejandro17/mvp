import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VideosFacade } from '../videos/services/videos.facade';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosFacade: VideosFacade) {}

  /**
   * Generate presigned URL for direct upload to temp bucket
   */
  @Post('presigned-upload-url')
  @UseGuards(JwtAuthGuard)
  async generatePresignedUploadUrl(@Body() request: any) {
    return this.videosFacade.generatePresignedUploadUrl(request);
  }

  /**
   * Mark video as ready after processing
   */
  @Post('mark-ready')
  async markVideoReady(@Body() request: any, @Req() req: any) {
    return this.videosFacade.markVideoReady(request, req);
  }

  /**
   * Mark video processing as failed
   */
  @Post('mark-error')
  async markVideoError(
    @Body() body: { classId: string; error: string },
    @Req() req: any,
  ) {
    return this.videosFacade.markVideoError(body, req);
  }

  /**
   * Mark video as processing (called by worker)
   */
  @Post('mark-processing')
  async markVideoProcessing(
    @Body() body: { classId: string; status: string },
    @Req() req: any,
  ) {
    return this.videosFacade.markVideoProcessing(body, req);
  }

  /**
   * Get video processing status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getVideoStatus(@Query('classId') classId: string) {
    return this.videosFacade.getVideoStatus(classId);
  }

  /**
   * Create a test class for video upload testing (development only)
   */
  @Post('create-test-class')
  @UseGuards(JwtAuthGuard)
  async createTestClass(
    @Body() body: { schoolId?: string; teacherId?: string },
    @Req() req,
  ) {
    return this.videosFacade.createTestClass(body, req);
  }
}
