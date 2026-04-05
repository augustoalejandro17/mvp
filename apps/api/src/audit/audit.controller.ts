import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { AuditFacade } from './services/audit.facade';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditFacade: AuditFacade) {}

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
    return this.auditFacade.findPaginated({
      page,
      limit,
      action,
      actorId,
      targetType,
      targetId,
    });
  }
}
