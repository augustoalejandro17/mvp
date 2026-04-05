import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit.service';

@Injectable()
export class AuditFacade {
  constructor(private readonly auditService: AuditService) {}

  private parseOptionalIntInRange(
    value: string | undefined,
    fieldName: string,
    min: number,
    max: number,
  ): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(
        `${fieldName} debe ser un entero entre ${min} y ${max}`,
      );
    }
    return parsed;
  }

  findPaginated(query: {
    page?: string;
    limit?: string;
    action?: string;
    actorId?: string;
    targetType?: string;
    targetId?: string;
  }) {
    return this.auditService.findPaginated({
      page: this.parseOptionalIntInRange(query.page, 'page', 1, 10000),
      limit: this.parseOptionalIntInRange(query.limit, 'limit', 1, 200),
      action: query.action,
      actorId: query.actorId,
      targetType: query.targetType,
      targetId: query.targetId,
    });
  }
}
