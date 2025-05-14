import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { SubscriptionsService } from '../plans/subscriptions.service';
import { PlansService } from '../plans/plans.service';
import { UpdateSubscriptionDto } from '../plans/dto/update-subscription.dto';
import { CreatePlanDto } from '../plans/dto/create-plan.dto';
import { UpdatePlanDto } from '../plans/dto/update-plan.dto';

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class SubscriptionAdminController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plansService: PlansService,
  ) {}

  // Endpoints para planes
  @Get('plans')
  getAllPlans() {
    return this.plansService.findAll();
  }

  @Get('plans/:id')
  getPlanById(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post('plans')
  createPlan(@Body() createPlanDto: CreatePlanDto) {
    return this.plansService.create(createPlanDto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() updatePlanDto: UpdatePlanDto) {
    return this.plansService.update(id, updatePlanDto);
  }

  @Delete('plans/:id')
  removePlan(@Param('id') id: string) {
    return this.plansService.remove(id);
  }

  // Endpoints para suscripciones
  @Get('list')
  getAllSubscriptions() {
    return this.subscriptionsService.findAll();
  }

  @Get('list/:id')
  getSubscriptionById(@Param('id') id: string) {
    return this.subscriptionsService.findOne(id);
  }

  @Get('by-school/:schoolId')
  getSubscriptionBySchool(@Param('schoolId') schoolId: string) {
    return this.subscriptionsService.findBySchool(schoolId);
  }

  @Patch(':id')
  updateSubscription(
    @Param('id') id: string, 
    @Body() updateSubscriptionDto: UpdateSubscriptionDto
  ) {
    return this.subscriptionsService.update(id, updateSubscriptionDto);
  }

  @Patch(':id/add-extra-resources')
  addExtraResources(
    @Param('id') id: string,
    @Body() extraResources: {
      extraUsers?: number;
      extraStorageGb?: number;
      extraStreamingMinutes?: number;
      extraCoursesPerUser?: number;
    }
  ) {
    // Este endpoint está optimizado para la gestión de recursos adicionales
    const updateDto: UpdateSubscriptionDto = {
      approvedExtraResources: extraResources
    };
    
    return this.subscriptionsService.update(id, updateDto);
  }

  @Delete(':id')
  cancelSubscription(@Param('id') id: string) {
    return this.subscriptionsService.remove(id);
  }
} 