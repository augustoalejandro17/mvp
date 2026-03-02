import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('audit-logs')
export class AuditController {
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

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async findPaginated(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
  ) {
    const parsedPage = this.parseOptionalIntInRange(page, 'page', 1, 10000);
    const parsedLimit = this.parseOptionalIntInRange(limit, 'limit', 1, 200);

    return this.auditService.findPaginated({
      page: parsedPage,
      limit: parsedLimit,
      action,
      actorId,
      targetType,
      targetId,
    });
  }
}
