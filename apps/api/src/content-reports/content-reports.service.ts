import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { School, SchoolDocument } from '../schools/schemas/school.schema';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { UpdateContentReportStatusDto } from './dto/update-content-report-status.dto';
import {
  ContentReport,
  ContentReportDocument,
  ReportContentType,
  ReportStatus,
} from './schemas/content-report.schema';

@Injectable()
export class ContentReportsService {
  constructor(
    @InjectModel(ContentReport.name)
    private readonly contentReportModel: Model<ContentReportDocument>,
    @InjectModel(Class.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
  ) {}

  async createReport(
    reporterId: string,
    dto: CreateContentReportDto,
  ): Promise<ContentReport> {
    const contentId = dto.contentId.trim();
    await this.validateContent(dto.contentType, contentId);

    const existingOpenReport = await this.contentReportModel.findOne({
      reporter: reporterId,
      contentType: dto.contentType,
      contentId,
      status: { $in: [ReportStatus.PENDING, ReportStatus.UNDER_REVIEW] },
    });

    if (existingOpenReport) {
      throw new ConflictException(
        'Ya enviaste una denuncia pendiente para este contenido',
      );
    }

    const report = await this.contentReportModel.create({
      reporter: reporterId,
      contentType: dto.contentType,
      contentId,
      contentTitle: dto.contentTitle?.trim(),
      reason: dto.reason,
      details: dto.details?.trim(),
      status: ReportStatus.PENDING,
    });

    return report;
  }

  async getMyReports(
    reporterId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ reports: ContentReport[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;

    const [reports, total] = await Promise.all([
      this.contentReportModel
        .find({ reporter: reporterId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.contentReportModel.countDocuments({ reporter: reporterId }),
    ]);

    return { reports, total };
  }

  async getAllReports(params: {
    status?: ReportStatus;
    contentType?: ReportContentType;
    page?: number;
    limit?: number;
  }): Promise<{ reports: ContentReport[]; total: number }> {
    const safePage = Math.max(1, params.page ?? 1);
    const safeLimit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (safePage - 1) * safeLimit;

    const filter: Record<string, unknown> = {};

    if (params.status) {
      filter.status = params.status;
    }

    if (params.contentType) {
      filter.contentType = params.contentType;
    }

    const [reports, total] = await Promise.all([
      this.contentReportModel
        .find(filter)
        .populate('reporter', 'name email role')
        .populate('reviewedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.contentReportModel.countDocuments(filter),
    ]);

    return { reports, total };
  }

  async updateReportStatus(
    reportId: string,
    reviewerId: string,
    dto: UpdateContentReportStatusDto,
  ): Promise<ContentReport> {
    const report = await this.contentReportModel.findById(reportId);

    if (!report) {
      throw new NotFoundException('Denuncia no encontrada');
    }

    report.status = dto.status;
    report.moderatorNotes = dto.moderatorNotes?.trim();
    report.reviewedAt = new Date();
    report.set('reviewedBy', new Types.ObjectId(reviewerId));

    await report.save();

    return report;
  }

  private async validateContent(
    contentType: ReportContentType,
    contentId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(contentId)) {
      throw new BadRequestException('contentId no es un ObjectId válido');
    }

    let exists = false;

    switch (contentType) {
      case ReportContentType.CLASS:
        exists = !!(await this.classModel.exists({ _id: contentId, isActive: true }));
        break;
      case ReportContentType.COURSE:
        exists = !!(await this.courseModel.exists({
          _id: contentId,
          isActive: true,
        }));
        break;
      case ReportContentType.SCHOOL:
        exists = !!(await this.schoolModel.exists({
          _id: contentId,
          isActive: true,
        }));
        break;
      default:
        exists = false;
    }

    if (!exists) {
      throw new NotFoundException('El contenido reportado no existe o no está activo');
    }
  }
}
