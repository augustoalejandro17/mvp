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
  async getAllSubscriptions(@Query('status') status?: string) {
    try {
      // Construir la consulta basada en el filtro de status opcional
      const query: any = {};
      if (status && status !== 'all') {
        query.status = status;
      }

      // Obtener suscripciones con datos de plan y escuela
      const subscriptions = await this.subscriptionsService.findAll();
      
      // Formatear los datos para el frontend
      const formattedSubscriptions = await Promise.all(subscriptions.map(async (sub: any) => {
        const school = sub.school ? sub.school : 
                     await this.subscriptionsService.findSchoolBySubscription(sub._id);
        
        return {
          id: sub._id,
          schoolName: school ? school.name : 'Escuela desconocida',
          schoolId: school ? school._id : null,
          planName: sub.plan ? sub.plan.name : 'Plan desconocido',
          planType: sub.plan ? sub.plan.type : 'unknown',
          status: sub.status,
          startDate: sub.startDate,
          endDate: sub.endDate,
          currentStorageGb: sub.currentStorageGb || 0,
          currentStreamingMinutes: sub.currentStreamingMinutes || 0
        };
      }));

      return {
        subscriptions: formattedSubscriptions,
        totalCount: formattedSubscriptions.length
      };
    } catch (error) {
      console.error('Error obteniendo suscripciones:', error);
      return {
        error: 'Error obteniendo suscripciones',
        message: error.message,
        subscriptions: [],
        totalCount: 0
      };
    }
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