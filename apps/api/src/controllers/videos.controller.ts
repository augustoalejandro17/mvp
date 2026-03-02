import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  Get,
  Query,
  BadRequestException,
  Req,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { S3Service } from '../services/s3.service';
import { ClassesService } from '../classes/classes.service';
import { VideoStatus } from '../classes/schemas/class.schema';
import { Types } from 'mongoose';

interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  schoolId: string;
  classId: string;
}

interface MarkReadyRequest {
  classId: string;
  videoUrl: string;
}

@Controller('videos')
export class VideosController {
  private readonly logger = new Logger(VideosController.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly classesService: ClassesService,
  ) {}

  private ensureWorkerAuthorized(req: any): void {
    const configuredSecret = process.env.VIDEO_WORKER_SECRET;
    if (!configuredSecret) {
      return;
    }

    const providedSecret = req.headers?.['x-worker-secret'];
    if (!providedSecret || providedSecret !== configuredSecret) {
      throw new UnauthorizedException('Invalid worker secret');
    }
  }

  /**
   * Generate presigned URL for direct upload to temp bucket
   */
  @Post('presigned-upload-url')
  @UseGuards(JwtAuthGuard)
  async generatePresignedUploadUrl(@Body() request: PresignedUrlRequest) {
    try {
      // Validate MongoDB ObjectId format
      if (!Types.ObjectId.isValid(request.classId)) {
        throw new BadRequestException(
          `Invalid class ID format: ${request.classId}. Please use a valid MongoDB ObjectId.`,
        );
      }

      this.logger.log(`Generating presigned URL for class ${request.classId}`);

      // Check if class exists
      const classExists = await this.classesService.findOne(request.classId);
      if (!classExists) {
        throw new BadRequestException(`Class not found: ${request.classId}`);
      }

      const result = await this.s3Service.generatePresignedUploadUrl(
        request.fileName,
        request.fileType,
        request.schoolId,
        request.classId,
      );

      // Update class status to UPLOADING and store temp key
      await this.classesService.updateVideoStatus(
        request.classId,
        VideoStatus.UPLOADING,
        result.key,
      );

      return {
        uploadUrl: result.uploadUrl,
        key: result.key,
        message: 'Presigned URL generated successfully',
      };
    } catch (error) {
      this.logger.error('Error generating presigned URL:', error);
      throw error;
    }
  }

  /**
   * Mark video as ready after processing
   */
  @Post('mark-ready')
  async markVideoReady(@Body() request: MarkReadyRequest, @Req() req: any) {
    try {
      this.ensureWorkerAuthorized(req);

      // Validate MongoDB ObjectId format
      if (!Types.ObjectId.isValid(request.classId)) {
        throw new BadRequestException(
          `Invalid class ID format: ${request.classId}`,
        );
      }

      this.logger.log(`Marking video ready for class ${request.classId}`);

      await this.classesService.updateVideoUrlAndStatus(
        request.classId,
        request.videoUrl,
        VideoStatus.READY,
      );

      // Optional: Send notification to teachers/admins
      // await this.notificationService.notifyVideoReady(request.classId);

      return {
        success: true,
        message: 'Video marked as ready successfully',
      };
    } catch (error) {
      this.logger.error('Error marking video as ready:', error);
      throw error;
    }
  }

  /**
   * Mark video processing as failed
   */
  @Post('mark-error')
  async markVideoError(
    @Body() body: { classId: string; error: string },
    @Req() req: any,
  ) {
    try {
      this.ensureWorkerAuthorized(req);

      // Validate MongoDB ObjectId format
      if (!Types.ObjectId.isValid(body.classId)) {
        throw new BadRequestException(
          `Invalid class ID format: ${body.classId}`,
        );
      }

      this.logger.log(
        `Marking video error for class ${body.classId}: ${body.error}`,
      );

      await this.classesService.updateVideoStatus(
        body.classId,
        VideoStatus.ERROR,
        null,
        body.error,
      );

      return {
        success: true,
        message: 'Video error status updated',
      };
    } catch (error) {
      this.logger.error('Error marking video error:', error);
      throw error;
    }
  }

  /**
   * Mark video as processing (called by worker)
   */
  @Post('mark-processing')
  async markVideoProcessing(
    @Body() body: { classId: string; status: string },
    @Req() req: any,
  ) {
    try {
      this.ensureWorkerAuthorized(req);

      // Validate MongoDB ObjectId format
      if (!Types.ObjectId.isValid(body.classId)) {
        throw new BadRequestException(
          `Invalid class ID format: ${body.classId}`,
        );
      }

      this.logger.log(
        `Marking video as processing for class ${body.classId}: ${body.status}`,
      );

      let videoStatus: VideoStatus;
      switch (body.status) {
        case 'PROCESSING':
          videoStatus = VideoStatus.PROCESSING;
          break;
        case 'UPLOADING':
          videoStatus = VideoStatus.UPLOADING;
          break;
        default:
          videoStatus = VideoStatus.PROCESSING;
      }

      await this.classesService.updateVideoStatus(body.classId, videoStatus);

      return {
        success: true,
        message: 'Video processing status updated',
      };
    } catch (error) {
      this.logger.error('Error marking video as processing:', error);
      throw error;
    }
  }

  /**
   * Get video processing status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getVideoStatus(@Query('classId') classId: string) {
    try {
      // Validate MongoDB ObjectId format
      if (!Types.ObjectId.isValid(classId)) {
        throw new BadRequestException(`Invalid class ID format: ${classId}`);
      }

      const classData = await this.classesService.findOne(classId);

      if (!classData) {
        throw new BadRequestException(`Class not found: ${classId}`);
      }

      return {
        classId,
        videoStatus: classData.videoStatus,
        videoUrl: classData.videoUrl,
        videoProcessingError: classData.videoProcessingError,
        tempVideoKey: classData.tempVideoKey,
      };
    } catch (error) {
      this.logger.error('Error getting video status:', error);
      throw error;
    }
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
    try {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException(
          'Test endpoints not available in production',
        );
      }

      // Get user info from JWT token
      const userId = req.user.sub || req.user._id || req.user.userId;
      if (!userId) {
        throw new InternalServerErrorException(
          'No se pudo identificar al usuario autenticado',
        );
      }

      // Generate IDs if not provided
      const schoolId = body.schoolId || new Types.ObjectId().toString();
      const teacherId = body.teacherId || userId;
      const courseId = new Types.ObjectId().toString();

      // Create a test class document directly
      const testClassData = {
        title: 'Test Video Upload Class',
        description: 'Class created for testing video upload functionality',
        course: courseId,
        teacher: teacherId,
        school: schoolId,
        videoStatus: VideoStatus.UPLOADING,
        videoUrl: null,
        tempVideoKey: null,
        videoProcessingError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create the class using the service's model
      const testClass =
        await this.classesService.createTestClass(testClassData);

      this.logger.log(`Test class created: ${testClass._id}`);

      return {
        success: true,
        classId: testClass._id.toString(),
        schoolId: schoolId,
        courseId: courseId,
        message: 'Test class created successfully',
      };
    } catch (error) {
      this.logger.error('Error creating test class:', error);
      throw error;
    }
  }
}
