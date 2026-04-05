import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
  Delete,
  Put,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/schemas/user.schema';
import { AdminSubscriptionsFacade } from '../services/admin-subscriptions.facade';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN) // Only super admins can manage subscriptions
export class SubscriptionsController {
  constructor(
    private readonly adminSubscriptionsFacade: AdminSubscriptionsFacade,
  ) {}

  @Get('list')
  async getAllSubscriptions(@Query('status') status?: string) {
    return this.adminSubscriptionsFacade.getAllSubscriptions(status);
  }

  @Get('test')
  async testDatabase() {
    return this.adminSubscriptionsFacade.testDatabase();
  }

  @Get('plans')
  async getAllPlans(@Query('active') active?: string) {
    return this.adminSubscriptionsFacade.getAllPlans(active);
  }

  @Get('plans/:id')
  async getPlanById(@Param('id') id: string) {
    return this.adminSubscriptionsFacade.getPlanById(id);
  }

  @Post('plans')
  async createPlan(@Body() planData: CreatePlanDto) {
    return this.adminSubscriptionsFacade.createPlan(planData);
  }

  @Put('plans/:id')
  async replacePlan(
    @Param('id') id: string,
    @Body() planData: UpdatePlanDto,
  ) {
    return this.adminSubscriptionsFacade.updatePlan(id, planData);
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() planData: UpdatePlanDto) {
    return this.adminSubscriptionsFacade.updatePlan(id, planData);
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string) {
    return this.adminSubscriptionsFacade.deletePlan(id);
  }

  @Get('list/:id')
  async getSubscriptionById(@Param('id') id: string) {
    return this.adminSubscriptionsFacade.getSubscriptionById(id);
  }

  @Get('by-school/:schoolId')
  async getSubscriptionBySchool(@Param('schoolId') schoolId: string) {
    return this.adminSubscriptionsFacade.getSubscriptionBySchool(schoolId);
  }

  @Patch(':id')
  async updateSubscription(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.adminSubscriptionsFacade.updateSubscription(
      id,
      updateSubscriptionDto,
    );
  }

  @Patch(':id/add-extra-resources')
  async addExtraResources(
    @Param('id') id: string,
    @Body()
    extraResources: NonNullable<
      UpdateSubscriptionDto['approvedExtraResources']
    >,
  ) {
    return this.adminSubscriptionsFacade.addExtraResources(id, extraResources);
  }

  @Delete(':id')
  async cancelSubscription(@Param('id') id: string) {
    return this.adminSubscriptionsFacade.cancelSubscription(id);
  }
}
