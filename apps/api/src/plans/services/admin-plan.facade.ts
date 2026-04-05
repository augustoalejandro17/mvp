import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AssignPlanDto,
  GrantExtraResourcesDto,
} from '../dto/admin-plan.dto';
import { PlansService } from '../plans.service';
import { UserRole } from '../../auth/schemas/user.schema';

@Injectable()
export class AdminPlanFacade {
  constructor(private readonly plansService: PlansService) {}

  private async ensureSchoolAccess(user: any, academyId: string) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    const hasAccess = await this.plansService.checkSchoolAccess(user, academyId);
    if (!hasAccess) {
      throw new ForbiddenException(
        'No tienes permiso para gestionar esta escuela',
      );
    }
  }

  private async ensureSchoolViewAccess(user: any, academyId: string) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    const hasAccess = await this.plansService.checkSchoolAccess(user, academyId);
    if (!hasAccess) {
      throw new ForbiddenException('No tienes permiso para ver esta escuela');
    }
  }

  async assignPlan(user: any, academyId: string, assignPlanDto: AssignPlanDto) {
    await this.ensureSchoolAccess(user, academyId);
    return this.plansService.assignPlanToAcademyById(
      academyId,
      assignPlanDto.planId,
    );
  }

  async grantExtraResources(
    user: any,
    academyId: string,
    grantResourcesDto: GrantExtraResourcesDto,
  ) {
    await this.ensureSchoolAccess(user, academyId);
    return this.plansService.grantExtraResources(academyId, grantResourcesDto);
  }

  async getAcademyPlanDetails(user: any, academyId: string) {
    await this.ensureSchoolViewAccess(user, academyId);
    return this.plansService.getAcademyPlanDetails(academyId);
  }

  async getAcademyOverages(user: any, academyId: string) {
    await this.ensureSchoolViewAccess(user, academyId);
    return this.plansService.getAcademyOverages(academyId);
  }

  getAvailablePlans() {
    return this.plansService.getAllPlanConfigurations();
  }

  validatePlanLimits(academyId: string) {
    return this.plansService.validateAllLimits(academyId);
  }

  resetUsageCounters(academyId: string) {
    return this.plansService.resetUsageCounters(academyId);
  }
}
