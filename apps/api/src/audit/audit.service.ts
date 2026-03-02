import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface CreateAuditLogInput {
  action: string;
  actorId: string;
  actorEmail?: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    await this.auditLogModel.create({
      action: input.action,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata || {},
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  async findPaginated(params: {
    page?: number;
    limit?: number;
    action?: string;
    actorId?: string;
    targetType?: string;
    targetId?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (params.action) filter.action = params.action;
    if (params.actorId) filter.actorId = params.actorId;
    if (params.targetType) filter.targetType = params.targetType;
    if (params.targetId) filter.targetId = params.targetId;

    const [items, total] = await Promise.all([
      this.auditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
