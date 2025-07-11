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
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/schemas/user.schema';
import { PlansService } from '../plans.service';
import { AssignPlanDto, GrantExtraResourcesDto } from '../dto/admin-plan.dto';

@Controller('admin/academies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER, UserRole.ADMINISTRATIVE)
export class AdminPlanController {
  constructor(private readonly plansService: PlansService) {}

  /**
   * Assign a new plan to an academy
   */
  @Put(':id/plan')
  async assignPlan(
    @Param('id') academyId: string,
    @Body() assignPlanDto: AssignPlanDto,
    @Request() req,
  ) {
    // Check access for non-super-admin users
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      const hasAccess = await this.plansService.checkSchoolAccess(
        req.user,
        academyId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'No tienes permiso para gestionar esta escuela',
        );
      }
    }

    return this.plansService.assignPlanToAcademyById(
      academyId,
      assignPlanDto.planId,
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
    // Check access for non-super-admin users
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      const hasAccess = await this.plansService.checkSchoolAccess(
        req.user,
        academyId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'No tienes permiso para gestionar esta escuela',
        );
      }
    }

    return this.plansService.grantExtraResources(academyId, grantResourcesDto);
  }

  /**
   * Get academy plan details and usage
   */
  @Get(':id/plan')
  async getAcademyPlanDetails(@Param('id') academyId: string, @Request() req) {
    // Check access for non-super-admin users
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      const hasAccess = await this.plansService.checkSchoolAccess(
        req.user,
        academyId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('No tienes permiso para ver esta escuela');
      }
    }

    return this.plansService.getAcademyPlanDetails(academyId);
  }

  /**
   * Get academy overage history
   */
  @Get(':id/overages')
  async getAcademyOverages(@Param('id') academyId: string, @Request() req) {
    // Check access for non-super-admin users
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      const hasAccess = await this.plansService.checkSchoolAccess(
        req.user,
        academyId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('No tienes permiso para ver esta escuela');
      }
    }

    return this.plansService.getAcademyOverages(academyId);
  }

  /**
   * Get all available plans
   */
  @Get('plans/available')
  async getAvailablePlans() {
    return this.plansService.getAllPlanConfigurations();
  }

  /**
   * Validate academy plan limits
   */
  @Post(':id/validate-limits')
  async validatePlanLimits(@Param('id') academyId: string) {
    return this.plansService.validateAllLimits(academyId);
  }

  /**
   * Reset academy usage counters (new billing period)
   */
  @Post(':id/reset-usage')
  @HttpCode(HttpStatus.OK)
  async resetUsageCounters(@Param('id') academyId: string) {
    return this.plansService.resetUsageCounters(academyId);
  }
}
