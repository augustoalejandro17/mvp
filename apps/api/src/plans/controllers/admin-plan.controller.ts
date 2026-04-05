import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/schemas/user.schema';
import { AssignPlanDto, GrantExtraResourcesDto } from '../dto/admin-plan.dto';
import { AdminPlanFacade } from '../services/admin-plan.facade';

@Controller('admin/academies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE)
export class AdminPlanController {
  constructor(
    private readonly adminPlanFacade: AdminPlanFacade,
  ) {}

  /**
   * Assign a new plan to an academy
   */
  @Put(':id/plan')
  async assignPlan(
    @Param('id') academyId: string,
    @Body() assignPlanDto: AssignPlanDto,
    @Request() req,
  ) {
    return this.adminPlanFacade.assignPlan(
      req.user,
      academyId,
      assignPlanDto,
    );
  }

  /**
   * Grant extra resources to an academy
   */
  @Put(':id/addons')
  async grantExtraResources(
    @Param('id') academyId: string,
    @Body() grantResourcesDto: GrantExtraResourcesDto,
    @Request() req,
  ) {
    return this.adminPlanFacade.grantExtraResources(
      req.user,
      academyId,
      grantResourcesDto,
    );
  }

  /**
   * Get academy plan details and usage
   */
  @Get(':id/plan')
  async getAcademyPlanDetails(@Param('id') academyId: string, @Request() req) {
    return this.adminPlanFacade.getAcademyPlanDetails(
      req.user,
      academyId,
    );
  }

  /**
   * Get academy overage history
   */
  @Get(':id/overages')
  async getAcademyOverages(@Param('id') academyId: string, @Request() req) {
    return this.adminPlanFacade.getAcademyOverages(
      req.user,
      academyId,
    );
  }

  /**
   * Get all available plans
   */
  @Get('plans/available')
  async getAvailablePlans() {
    return this.adminPlanFacade.getAvailablePlans();
  }

  /**
   * Validate academy plan limits
   */
  @Post(':id/validate-limits')
  async validatePlanLimits(@Param('id') academyId: string) {
    return this.adminPlanFacade.validatePlanLimits(academyId);
  }

  /**
   * Reset academy usage counters (new billing period)
   */
  @Post(':id/reset-usage')
  @HttpCode(HttpStatus.OK)
  async resetUsageCounters(@Param('id') academyId: string) {
    return this.adminPlanFacade.resetUsageCounters(academyId);
  }
}
