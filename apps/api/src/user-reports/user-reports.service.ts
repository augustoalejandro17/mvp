import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { CreateUserReportDto } from './dto/create-user-report.dto';
import { UpdateUserReportStatusDto } from './dto/update-user-report-status.dto';
import {
  UserReport,
  UserReportDocument,
  UserReportStatus,
} from './schemas/user-report.schema';

@Injectable()
export class UserReportsService {
  constructor(
    @InjectModel(UserReport.name)
    private readonly userReportModel: Model<UserReportDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async createReport(
    reporterId: string,
    dto: CreateUserReportDto,
  ): Promise<UserReport> {
    const reportedUserId = dto.reportedUserId.trim();

    if (!Types.ObjectId.isValid(reportedUserId)) {
      throw new BadRequestException('reportedUserId no es un ObjectId válido');
    }

    if (reportedUserId === reporterId) {
      throw new BadRequestException('No puedes denunciar tu propia cuenta');
    }

    const reportedUser = await this.userModel.findById(reportedUserId);
    if (!reportedUser || !reportedUser.isActive) {
      throw new NotFoundException(
        'El usuario reportado no existe o no está activo',
      );
    }

    const existingOpenReport = await this.userReportModel.findOne({
      reporter: reporterId,
      reportedUser: reportedUserId,
      status: { $in: [UserReportStatus.PENDING, UserReportStatus.UNDER_REVIEW] },
    });

    if (existingOpenReport) {
      throw new ConflictException(
        'Ya enviaste una denuncia pendiente para este usuario',
      );
    }

    return this.userReportModel.create({
      reporter: reporterId,
      reportedUser: reportedUserId,
      reason: dto.reason,
      details: dto.details?.trim(),
      status: UserReportStatus.PENDING,
    });
  }

  async getMyReports(
    reporterId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ reports: UserReport[]; total: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;

    const [reports, total] = await Promise.all([
      this.userReportModel
        .find({ reporter: reporterId })
        .populate('reportedUser', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.userReportModel.countDocuments({ reporter: reporterId }),
    ]);

    return { reports, total };
  }

  async getAllReports(params: {
    status?: UserReportStatus;
    page?: number;
    limit?: number;
  }): Promise<{ reports: UserReport[]; total: number }> {
    const safePage = Math.max(1, params.page ?? 1);
    const safeLimit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (safePage - 1) * safeLimit;
    const filter: Record<string, unknown> = {};

    if (params.status) {
      filter.status = params.status;
    }

    const [reports, total] = await Promise.all([
      this.userReportModel
        .find(filter)
        .populate('reporter', 'name email role')
        .populate('reportedUser', 'name email role')
        .populate('reviewedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      this.userReportModel.countDocuments(filter),
    ]);

    return { reports, total };
  }

  async updateReportStatus(
    reportId: string,
    reviewerId: string,
    dto: UpdateUserReportStatusDto,
  ): Promise<UserReport> {
    const report = await this.userReportModel.findById(reportId);

    if (!report) {
      throw new NotFoundException('Denuncia de usuario no encontrada');
    }

    report.status = dto.status;
    report.moderatorNotes = dto.moderatorNotes?.trim();
    report.reviewedAt = new Date();
    report.set('reviewedBy', new Types.ObjectId(reviewerId));
    await report.save();

    return report;
  }
}
