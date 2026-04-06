import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from '../auth/schemas/user.schema';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import {
  Enrollment,
  EnrollmentDocument,
} from '../courses/schemas/enrollment.schema';
import { S3Service } from '../services/s3.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateClassSubmissionDto } from './dto/create-class-submission.dto';
import { CreateSubmissionAnnotationDto } from './dto/create-submission-annotation.dto';
import { UpdateClassSubmissionReviewStatusDto } from './dto/update-class-submission-review-status.dto';
import { UpdateSubmissionAnnotationDto } from './dto/update-submission-annotation.dto';
import {
  ClassSubmission,
  ClassSubmissionDocument,
  SubmissionReviewStatus,
  SubmissionVideoStatus,
} from './schemas/class-submission.schema';
import {
  SubmissionAnnotation,
  SubmissionAnnotationDocument,
} from './schemas/submission-annotation.schema';

interface CourseAccessContext {
  classItem: ClassDocument;
  course: CourseDocument;
}

@Injectable()
export class ClassSubmissionsService {
  private readonly logger = new Logger(ClassSubmissionsService.name);

  constructor(
    @InjectModel(ClassSubmission.name)
    private readonly classSubmissionModel: Model<ClassSubmissionDocument>,
    @InjectModel(SubmissionAnnotation.name)
    private readonly submissionAnnotationModel: Model<SubmissionAnnotationDocument>,
    @InjectModel(Class.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Enrollment.name)
    private readonly enrollmentModel: Model<EnrollmentDocument>,
    private readonly s3Service: S3Service,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submit(
    studentId: string,
    role: UserRole | string | undefined,
    dto: CreateClassSubmissionDto,
    videoFile: Express.Multer.File,
  ): Promise<ClassSubmission> {
    this.logger.log(
      `Receiving class submission upload. student=${studentId} class=${dto.classId} file=${videoFile?.originalname || 'none'}`,
    );

    if (!videoFile) {
      throw new BadRequestException('Se requiere un archivo de video');
    }

    const { classItem, course } = await this.getCourseAccessContext(dto.classId);
    await this.ensureStudentCanSubmit(
      studentId,
      role,
      course._id.toString(),
    );

    const schoolId = this.extractId(course.school);
    const teacherId = this.extractId(classItem.teacher ?? course.teacher);
    const teacherRecipientIds = [
      this.extractId(course.teacher),
      ...(course.teachers || []).map((teacher) => this.extractId(teacher)),
    ];

    const existingSubmission = await this.classSubmissionModel.findOne({
      class: classItem._id,
      student: studentId,
    });
    let submission = existingSubmission;

    const now = new Date();
    if (!submission) {
      submission = new this.classSubmissionModel({
        class: classItem._id,
        course: course._id,
        school: schoolId,
        student: studentId,
        teacher: teacherId,
      });
    }

    submission.course = course._id as any;
    submission.school = schoolId as any;
    submission.student = studentId as any;
    submission.teacher = teacherId as any;
    submission.videoStatus = SubmissionVideoStatus.UPLOADING;
    submission.reviewStatus = SubmissionReviewStatus.SUBMITTED;
    submission.videoProcessingError = null;
    submission.videoMetadata = {
      name: videoFile.originalname,
      size: videoFile.size,
      mimeType: videoFile.mimetype,
    };
    submission.submittedAt = now;
    submission.reviewedAt = null;
    submission.tempVideoKey = null;
    submission.videoUrl = null;
    submission.videoKey = null;

    await submission.save();

    try {
      const { uploadUrl, key } =
        await this.s3Service.generateSubmissionPresignedUploadUrl(
          videoFile.originalname,
          videoFile.mimetype,
          schoolId,
          classItem._id.toString(),
          studentId,
          submission._id.toString(),
        );

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: videoFile.buffer as unknown as BodyInit,
        headers: {
          'Content-Type': videoFile.mimetype,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      submission.tempVideoKey = key;
      submission.videoStatus = SubmissionVideoStatus.UPLOADING;
      submission.videoProcessingError = null;
      await submission.save();

      await this.submissionAnnotationModel.deleteMany({
        submission: submission._id,
      });

      try {
        await this.notificationsService.notifyTeachersAboutSubmission(
          teacherRecipientIds,
          course._id.toString(),
          classItem._id.toString(),
          classItem.title,
          submission._id.toString(),
          studentId,
          Boolean(existingSubmission),
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo crear la notificación al profesor para ${submission._id}: ${error.message}`,
        );
      }

      const plainSubmission = await this.classSubmissionModel
        .findById(submission._id)
        .lean()
        .exec();

      return (plainSubmission || submission.toObject()) as ClassSubmission;
    } catch (error) {
      this.logger.error(
        `Error subiendo entrega ${submission._id}: ${error.message}`,
        error.stack,
      );

      submission.videoStatus = SubmissionVideoStatus.ERROR;
      submission.videoProcessingError = `Upload failed: ${error.message}`;
      await submission.save();

      throw new InternalServerErrorException(
        `No se pudo subir el video: ${error.message}`,
      );
    }
  }

  async findMine(
    studentId: string,
    classId?: string,
  ): Promise<ClassSubmission[]> {
    const query: Record<string, unknown> = {
      student: studentId,
    };

    if (classId) {
      this.ensureValidObjectId(classId, 'classId');
      query.class = classId;
    }

    const submissions = await this.classSubmissionModel
      .find(query)
      .populate('class', 'title order')
      .populate('course', 'title')
      .sort({ submittedAt: -1, createdAt: -1 })
      .exec();

    return this.attachAnnotationCounts(submissions);
  }

  async findByClass(
    classId: string,
    userId: string,
    role: UserRole | string | undefined,
  ): Promise<ClassSubmission[]> {
    const { course } = await this.getCourseAccessContext(classId);
    await this.ensureTeacherCanReview(userId, role, course);

    const submissions = await this.classSubmissionModel
      .find({ class: classId })
      .populate('student', 'name email')
      .populate('class', 'title order')
      .sort({ submittedAt: -1, createdAt: -1 })
      .exec();

    return this.attachAnnotationCounts(submissions);
  }

  async findOne(
    submissionId: string,
    userId: string,
    role: UserRole | string | undefined,
  ): Promise<ClassSubmission> {
    const submission = await this.getSubmissionOrFail(submissionId);
    await this.ensureCanViewSubmission(submission, userId, role);

    return this.classSubmissionModel
      .findById(submissionId)
      .populate('student', 'name email')
      .populate('teacher', 'name email')
      .populate('class', 'title order course')
      .populate('course', 'title school')
      .exec();
  }

  async findAnnotations(
    submissionId: string,
    userId: string,
    role: UserRole | string | undefined,
  ): Promise<SubmissionAnnotation[]> {
    const submission = await this.getSubmissionOrFail(submissionId);
    await this.ensureCanViewSubmission(submission, userId, role);

    return this.submissionAnnotationModel
      .find({ submission: submission._id })
      .populate('author', 'name email')
      .sort({ timestampSeconds: 1, createdAt: 1 })
      .exec();
  }

  async createAnnotation(
    submissionId: string,
    authorId: string,
    role: UserRole | string | undefined,
    dto: CreateSubmissionAnnotationDto,
  ): Promise<SubmissionAnnotation> {
    const submission = await this.getSubmissionOrFail(submissionId);
    const course = await this.getCourseOrFail(submission.course);

    await this.ensureTeacherCanReview(authorId, role, course);

    if (submission.videoStatus !== SubmissionVideoStatus.READY) {
      throw new BadRequestException(
        'No se pueden agregar anotaciones hasta que el video esté listo',
      );
    }

    const annotation = await this.submissionAnnotationModel.create({
      submission: submission._id,
      author: authorId,
      timestampSeconds: dto.timestampSeconds,
      text: dto.text.trim(),
    });

    try {
      await this.notificationsService.notifySubmissionFeedback(
        this.extractId(submission.student),
        this.extractId(submission.course),
        this.extractId(submission.class),
        submission._id.toString(),
        dto.timestampSeconds,
        authorId,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo crear la notificación de feedback para ${submission._id}: ${error.message}`,
      );
    }

    return this.submissionAnnotationModel
      .findById(annotation._id)
      .populate('author', 'name email')
      .exec();
  }

  async updateAnnotation(
    submissionId: string,
    annotationId: string,
    userId: string,
    role: UserRole | string | undefined,
    dto: UpdateSubmissionAnnotationDto,
  ): Promise<SubmissionAnnotation> {
    const submission = await this.getSubmissionOrFail(submissionId);
    const course = await this.getCourseOrFail(submission.course);

    await this.ensureTeacherCanReview(userId, role, course);

    const annotation = await this.submissionAnnotationModel.findOne({
      _id: annotationId,
      submission: submission._id,
    });

    if (!annotation) {
      throw new NotFoundException('Anotación no encontrada');
    }

    if (typeof dto.timestampSeconds === 'number') {
      annotation.timestampSeconds = dto.timestampSeconds;
    }

    if (typeof dto.text === 'string') {
      annotation.text = dto.text.trim();
    }

    await annotation.save();

    return this.submissionAnnotationModel
      .findById(annotation._id)
      .populate('author', 'name email')
      .exec();
  }

  async deleteAnnotation(
    submissionId: string,
    annotationId: string,
    userId: string,
    role: UserRole | string | undefined,
  ): Promise<void> {
    const submission = await this.getSubmissionOrFail(submissionId);
    const course = await this.getCourseOrFail(submission.course);

    await this.ensureTeacherCanReview(userId, role, course);

    const result = await this.submissionAnnotationModel.deleteOne({
      _id: annotationId,
      submission: submission._id,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Anotación no encontrada');
    }
  }

  async updateReviewStatus(
    submissionId: string,
    userId: string,
    role: UserRole | string | undefined,
    dto: UpdateClassSubmissionReviewStatusDto,
  ): Promise<ClassSubmission> {
    const submission = await this.getSubmissionOrFail(submissionId);
    const course = await this.getCourseOrFail(submission.course);

    await this.ensureTeacherCanReview(userId, role, course);

    submission.reviewStatus = dto.reviewStatus;
    submission.reviewedAt =
      dto.reviewStatus === SubmissionReviewStatus.SUBMITTED
        ? null
        : new Date();
    await submission.save();

    if (
      dto.reviewStatus === SubmissionReviewStatus.REVIEWED ||
      dto.reviewStatus === SubmissionReviewStatus.NEEDS_RESUBMISSION
    ) {
      try {
        await this.notificationsService.notifySubmissionReviewStatus(
          this.extractId(submission.student),
          this.extractId(submission.course),
          this.extractId(submission.class),
          submission._id.toString(),
          dto.reviewStatus,
          userId,
        );
      } catch (error) {
        this.logger.warn(
          `No se pudo crear la notificación de revisión para ${submission._id}: ${error.message}`,
        );
      }
    }

    return this.findOne(submissionId, userId, role);
  }

  async markWorkerProcessing(
    submissionId: string,
    status: SubmissionVideoStatus,
  ): Promise<void> {
    const submission = await this.getSubmissionOrFail(submissionId);
    submission.videoStatus = status;
    submission.videoProcessingError = null;
    await submission.save();
  }

  async markWorkerReady(
    submissionId: string,
    videoUrl: string,
    videoKey?: string,
  ): Promise<void> {
    const submission = await this.getSubmissionOrFail(submissionId);
    const previousVideoUrl = submission.videoUrl;
    submission.videoUrl = videoUrl;
    submission.videoKey = videoKey || this.s3Service.getKeyFromUrl(videoUrl);
    submission.tempVideoKey = null;
    submission.videoStatus = SubmissionVideoStatus.READY;
    submission.videoProcessingError = null;
    await submission.save();

    if (previousVideoUrl && previousVideoUrl !== videoUrl) {
      void this.s3Service.deleteVideo(previousVideoUrl).catch((error) => {
        this.logger.warn(
          `No se pudo eliminar el video anterior de la entrega ${submissionId}: ${error.message}`,
        );
      });
    }
  }

  async markWorkerError(
    submissionId: string,
    errorMessage: string,
  ): Promise<void> {
    const submission = await this.getSubmissionOrFail(submissionId);
    submission.videoStatus = SubmissionVideoStatus.ERROR;
    submission.videoProcessingError = errorMessage;
    await submission.save();
  }

  private async getSubmissionOrFail(
    submissionId: string,
  ): Promise<ClassSubmissionDocument> {
    this.ensureValidObjectId(submissionId, 'submissionId');

    const submission = await this.classSubmissionModel.findById(submissionId);
    if (!submission) {
      throw new NotFoundException('Entrega no encontrada');
    }

    return submission;
  }

  private async getCourseAccessContext(
    classId: string,
  ): Promise<CourseAccessContext> {
    this.ensureValidObjectId(classId, 'classId');

    const classItem = await this.classModel.findById(classId);
    if (!classItem) {
      throw new NotFoundException('Clase no encontrada');
    }

    const course = await this.courseModel.findById(classItem.course);
    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    return { classItem, course };
  }

  private async getCourseOrFail(courseId: any): Promise<CourseDocument> {
    const course = await this.courseModel.findById(courseId);
    if (!course) {
      throw new NotFoundException('Curso no encontrado');
    }

    return course;
  }

  private async ensureStudentCanSubmit(
    userId: string,
    role: UserRole | string | undefined,
    courseId: string,
  ): Promise<void> {
    if (this.isElevatedRole(role)) {
      return;
    }

    if (String(role) !== UserRole.STUDENT) {
      throw new ForbiddenException(
        'Solo los alumnos pueden enviar entregas para esta funcionalidad',
      );
    }

    const enrollment = await this.enrollmentModel.findOne({
      course: courseId,
      student: userId,
      isActive: true,
    });

    if (!enrollment) {
      throw new ForbiddenException(
        'Debes estar inscrito en el curso para enviar una entrega',
      );
    }
  }

  private async ensureTeacherCanReview(
    userId: string,
    role: UserRole | string | undefined,
    course: CourseDocument,
  ): Promise<void> {
    if (this.isElevatedRole(role)) {
      return;
    }

    if (String(role) !== UserRole.TEACHER) {
      throw new ForbiddenException(
        'No tienes permisos para revisar entregas de alumnos',
      );
    }

    const teacherIds = [
      this.extractId(course.teacher),
      ...(course.teachers || []).map((teacherId) => this.extractId(teacherId)),
    ];

    if (!teacherIds.includes(userId)) {
      throw new ForbiddenException(
        'No puedes revisar entregas de un curso que no enseñas',
      );
    }
  }

  private async ensureCanViewSubmission(
    submission: ClassSubmissionDocument,
    userId: string,
    role: UserRole | string | undefined,
  ): Promise<void> {
    if (this.isElevatedRole(role)) {
      return;
    }

    if (this.extractId(submission.student) === userId) {
      return;
    }

    const course = await this.getCourseOrFail(submission.course);
    await this.ensureTeacherCanReview(userId, role, course);
  }

  private isElevatedRole(role?: UserRole | string): boolean {
    return [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.SCHOOL_OWNER,
      UserRole.ADMINISTRATIVE,
    ].includes(String(role) as UserRole);
  }

  private ensureValidObjectId(value: string, fieldName: string): void {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${fieldName} no es un ObjectId válido`);
    }
  }

  private extractId(value: any): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Types.ObjectId) {
      return value.toString();
    }

    if (typeof value === 'object' && '_id' in value && value._id) {
      return this.extractId(value._id);
    }

    if (typeof value?.toString === 'function') {
      return value.toString();
    }

    return String(value);
  }

  private async attachAnnotationCounts(
    submissions: any[],
  ): Promise<any[]> {
    if (!Array.isArray(submissions) || submissions.length === 0) {
      return submissions;
    }

    const counts = await this.submissionAnnotationModel.aggregate([
      {
        $match: {
          submission: {
            $in: submissions.map((submission) => new Types.ObjectId(this.extractId(submission._id))),
          },
        },
      },
      {
        $group: {
          _id: '$submission',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map<string, number>(
      counts.map((item) => [this.extractId(item._id), Number(item.count) || 0]),
    );

    return submissions.map((submission) => {
      const plain =
        typeof submission?.toObject === 'function'
          ? submission.toObject()
          : { ...submission };
      plain.annotationsCount = countMap.get(this.extractId(submission._id)) || 0;
      return plain;
    });
  }
}
