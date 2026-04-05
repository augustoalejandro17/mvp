import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ClassesService } from '../../classes/classes.service';
import { VideoStatus } from '../../classes/schemas/class.schema';
import { S3Service } from '../../services/s3.service';

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

@Injectable()
export class VideosFacade {
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

  private ensureValidClassId(classId: string): void {
    if (!Types.ObjectId.isValid(classId)) {
      throw new BadRequestException(`Invalid class ID format: ${classId}`);
    }
  }

  async generatePresignedUploadUrl(request: PresignedUrlRequest) {
    this.ensureValidClassId(request.classId);

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
  }

  async markVideoReady(request: MarkReadyRequest, req: any) {
    this.ensureWorkerAuthorized(req);
    this.ensureValidClassId(request.classId);

    await this.classesService.updateVideoUrlAndStatus(
      request.classId,
      request.videoUrl,
      VideoStatus.READY,
    );

    return {
      success: true,
      message: 'Video marked as ready successfully',
    };
  }

  async markVideoError(
    body: { classId: string; error: string },
    req: any,
  ) {
    this.ensureWorkerAuthorized(req);
    this.ensureValidClassId(body.classId);

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
  }

  async markVideoProcessing(
    body: { classId: string; status: string },
    req: any,
  ) {
    this.ensureWorkerAuthorized(req);
    this.ensureValidClassId(body.classId);

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
  }

  async getVideoStatus(classId: string) {
    this.ensureValidClassId(classId);

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
  }

  async createTestClass(
    body: { schoolId?: string; teacherId?: string },
    req: any,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException(
        'Test endpoints not available in production',
      );
    }

    const userId = req.user.sub || req.user._id || req.user.userId;
    if (!userId) {
      throw new InternalServerErrorException(
        'No se pudo identificar al usuario autenticado',
      );
    }

    const schoolId = body.schoolId || new Types.ObjectId().toString();
    const teacherId = body.teacherId || userId;
    const courseId = new Types.ObjectId().toString();

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

    const testClass = await this.classesService.createTestClass(testClassData);

    return {
      success: true,
      classId: testClass._id.toString(),
      schoolId,
      courseId,
      message: 'Test class created successfully',
    };
  }
}
