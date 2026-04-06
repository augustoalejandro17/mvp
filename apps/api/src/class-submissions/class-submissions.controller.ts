import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/schemas/user.schema';
import { CreateClassSubmissionDto } from './dto/create-class-submission.dto';
import { CreateSubmissionAnnotationDto } from './dto/create-submission-annotation.dto';
import { UpdateClassSubmissionReviewStatusDto } from './dto/update-class-submission-review-status.dto';
import { UpdateSubmissionAnnotationDto } from './dto/update-submission-annotation.dto';
import {
  SubmissionVideoStatus,
} from './schemas/class-submission.schema';
import { ClassSubmissionsService } from './class-submissions.service';

const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
  'video/x-matroska',
  'video/3gpp',
  'video/ogg',
  'video/x-m4v',
];

const ALLOWED_VIDEO_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mpeg',
  '.mpg',
  '.mkv',
  '.3gp',
  '.ogv',
  '.m4v',
];

const isAllowedVideoFile = (file: Express.Multer.File): boolean => {
  const mimeType = String(file.mimetype || '').toLowerCase();
  const fileName = String(file.originalname || '').toLowerCase();

  return (
    ALLOWED_VIDEO_MIME_TYPES.includes(mimeType) ||
    ALLOWED_VIDEO_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  );
};

const videoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: any, acceptFile: boolean) => void,
) => {
  if (isAllowedVideoFile(file)) {
    callback(null, true);
    return;
  }

  callback(
    new BadRequestException(
      `Formato de archivo no soportado: ${file.mimetype}. Solo se admiten archivos de video.`,
    ),
    false,
  );
};

@Controller('class-submissions')
export class ClassSubmissionsController {
  constructor(
    private readonly classSubmissionsService: ClassSubmissionsService,
  ) {}

  private ensureWorkerAuthorized(req: Request): void {
    const configuredSecret = process.env.VIDEO_WORKER_SECRET;
    if (!configuredSecret) {
      return;
    }

    const providedSecret = req.headers['x-worker-secret'];
    if (!providedSecret || providedSecret !== configuredSecret) {
      throw new UnauthorizedException('Invalid worker secret');
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.STUDENT,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 200 * 1024 * 1024,
      },
      fileFilter: videoFileFilter,
    }),
  )
  async submit(
    @Req() req: Request,
    @Body() dto: CreateClassSubmissionDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const role = user?.role;

    return this.classSubmissionsService.submit(userId, role, dto, file);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async findMine(@Req() req: Request, @Query('classId') classId?: string) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;

    return this.classSubmissionsService.findMine(userId, classId);
  }

  @Get('class/:classId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async findByClass(@Param('classId') classId: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const role = user?.role;

    return this.classSubmissionsService.findByClass(classId, userId, role);
  }

  @Post('worker/mark-processing')
  async markWorkerProcessing(
    @Req() req: Request,
    @Body() body: { submissionId: string; status: SubmissionVideoStatus },
  ) {
    this.ensureWorkerAuthorized(req);
    await this.classSubmissionsService.markWorkerProcessing(
      body.submissionId,
      body.status || SubmissionVideoStatus.PROCESSING,
    );

    return { success: true };
  }

  @Post('worker/mark-ready')
  async markWorkerReady(
    @Req() req: Request,
    @Body() body: { submissionId: string; videoUrl: string; videoKey?: string },
  ) {
    this.ensureWorkerAuthorized(req);
    await this.classSubmissionsService.markWorkerReady(
      body.submissionId,
      body.videoUrl,
      body.videoKey,
    );

    return { success: true };
  }

  @Post('worker/mark-error')
  async markWorkerError(
    @Req() req: Request,
    @Body() body: { submissionId: string; error: string },
  ) {
    this.ensureWorkerAuthorized(req);
    await this.classSubmissionsService.markWorkerError(
      body.submissionId,
      body.error,
    );

    return { success: true };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const role = user?.role;

    return this.classSubmissionsService.findOne(id, userId, role);
  }

  @Get(':id/annotations')
  @UseGuards(JwtAuthGuard)
  async findAnnotations(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const role = user?.role;

    return this.classSubmissionsService.findAnnotations(id, userId, role);
  }

  @Post(':id/annotations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async createAnnotation(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: CreateSubmissionAnnotationDto,
  ) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const role = user?.role;

    return this.classSubmissionsService.createAnnotation(id, userId, role, dto);
  }

  @Patch(':id/annotations/:annotationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async updateAnnotation(
    @Param('id') id: string,
    @Param('annotationId') annotationId: string,
    @Req() req: Request,
    @Body() dto: UpdateSubmissionAnnotationDto,
  ) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const role = user?.role;

    return this.classSubmissionsService.updateAnnotation(
      id,
      annotationId,
      userId,
      role,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  @Delete(':id/annotations/:annotationId')
  async deleteAnnotation(
    @Param('id') id: string,
    @Param('annotationId') annotationId: string,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const role = user?.role;

    await this.classSubmissionsService.deleteAnnotation(
      id,
      annotationId,
      userId,
      role,
    );

    return { success: true };
  }

  @Patch(':id/review-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  async updateReviewStatus(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateClassSubmissionReviewStatusDto,
  ) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const role = user?.role;

    return this.classSubmissionsService.updateReviewStatus(
      id,
      userId,
      role,
      dto,
    );
  }
}
