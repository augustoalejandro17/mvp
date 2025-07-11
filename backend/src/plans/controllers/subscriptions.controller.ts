import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/schemas/user.schema';
import { School } from '../../schools/schemas/school.schema';
import { Subscription } from '../schemas/subscription.schema';
import { Plan } from '../schemas/plan.schema';

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN) // Only super admins can manage subscriptions
export class SubscriptionsController {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
    @InjectModel(School.name) private schoolModel: Model<School>,
  ) {}

  @Get('list')
  async getAllSubscriptions(@Query('status') status?: string) {
    try {
      // Build the query based on optional status filter
      const query: any = {};
      if (status && status !== 'all') {
        query.status = status;
      }

      // Get subscriptions with populated plan and school data
      const subscriptions = await this.subscriptionModel
        .find(query)
        .populate('plan')
        .populate('school', 'name')
        .sort({ startDate: -1 })
        .exec();

      // Format the data for the frontend
      const formattedSubscriptions = await Promise.all(
        subscriptions.map(async (sub) => {
          const school = await this.schoolModel.findOne({
            activeSubscription: sub._id,
          });
          const schoolName = school ? school.name : 'Unknown School';

          return {
            id: sub._id,
            schoolName,
            schoolId: school ? school._id : null,
            planName: sub.plan ? (sub.plan as any).name : 'Unknown Plan',
            planType: sub.plan ? (sub.plan as any).type : 'Unknown',
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate,
            currentStorageGb: sub.currentStorageGb || 0,
            currentStreamingMinutes: sub.currentStreamingMinutes || 0,
          };
        }),
      );

      return {
        subscriptions: formattedSubscriptions,
        totalCount: formattedSubscriptions.length,
      };
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      return {
        error: 'Error fetching subscriptions',
        message: error.message,
      };
    }
  }

  @Get('test')
  async testDatabase() {
    try {
      const count = await this.planModel.countDocuments();
      const firstPlan = await this.planModel.findOne().exec();

      return {
        success: true,
        totalPlans: count,
        samplePlan: firstPlan
          ? {
              id: firstPlan._id,
              name: firstPlan.name,
              monthlyPrice: firstPlan.monthlyPrice,
              maxUsers: firstPlan.maxUsers,
              rawData: firstPlan,
            }
          : null,
        message: `Connected to database, found ${count} plans`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Database connection failed',
      };
    }
  }

  @Get('plans')
  async getAllPlans(@Query('active') active?: string) {
    try {
      // Build the query based on optional active filter
      const query: any = {};
      if (active === 'true') {
        query.isActive = true;
      } else if (active === 'false') {
        query.isActive = false;
      }

      // Get all plans
      const plans = await this.planModel
        .find(query)
        .sort({ monthlyPriceCents: 1, name: 1 })
        .exec();

      // Count subscriptions for each plan
      const plansWithStats = await Promise.all(
        plans.map(async (plan, index) => {
          const subscriptionsCount =
            await this.subscriptionModel.countDocuments({ plan: plan._id });

          // Handle both new and legacy field names
          const priceCents =
            plan.monthlyPriceCents ||
            plan.monthlyPrice * 100 ||
            plan.price * 100 ||
            0;
          const storage = plan.storageGB || plan.maxStorageGb || 0;
          const streaming =
            plan.streamingHoursPerMonth ||
            plan.maxStreamingMinutesPerMonth / 60 ||
            0;
          const students = plan.studentSeats || plan.maxUsers || 0;
          const teachersCount = plan.teachers || 2; // Default fallback
          const concurrentCourses =
            plan.maxConcurrentCoursesPerStudent || plan.maxCoursesPerUser || 1;

          const result = {
            _id: plan._id,
            id: plan._id,
            name: plan.name,
            type: plan.type,
            description: plan.description,
            price: priceCents, // Price in cents for frontend
            isActive: plan.isActive !== false, // Default to true if not set
            studentSeats: students,
            teachers: teachersCount,
            maxConcurrentCoursesPerStudent: concurrentCourses,
            storageGb: storage,
            streamingHours: streaming,
            features: plan.features || [],
            subscriptionsCount,
          };
          return result;
        }),
      );

      console.log('✅ Returning formatted plans to frontend');
      return {
        plans: plansWithStats,
        totalCount: plansWithStats.length,
      };
    } catch (error) {
      console.error('❌ Error fetching plans:', error);
      return {
        error: 'Error fetching plans',
        message: error.message,
      };
    }
  }

  @Post('plans')
  async createPlan(@Body() planData: any) {
    try {
      const newPlan = new this.planModel(planData);
      const savedPlan = await newPlan.save();

      return {
        success: true,
        plan: savedPlan,
      };
    } catch (error) {
      console.error('Error creating plan:', error);
      return {
        error: 'Error creating plan',
        message: error.message,
      };
    }
  }

  @Put('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() planData: any) {
    try {
      const updatedPlan = await this.planModel.findByIdAndUpdate(id, planData, {
        new: true,
      });

      if (!updatedPlan) {
        return {
          error: 'Plan not found',
          message: `No plan found with ID ${id}`,
        };
      }

      return {
        success: true,
        plan: updatedPlan,
      };
    } catch (error) {
      console.error('Error updating plan:', error);
      return {
        error: 'Error updating plan',
        message: error.message,
      };
    }
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string) {
    try {
      // Check if plan is being used by any subscriptions
      const subscriptionsCount = await this.subscriptionModel.countDocuments({
        plan: id,
      });

      if (subscriptionsCount > 0) {
        return {
          error: 'Cannot delete plan',
          message: `This plan is being used by ${subscriptionsCount} subscription(s)`,
        };
      }

      const deletedPlan = await this.planModel.findByIdAndDelete(id);

      if (!deletedPlan) {
        return {
          error: 'Plan not found',
          message: `No plan found with ID ${id}`,
        };
      }

      return {
        success: true,
        message: 'Plan deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting plan:', error);
      return {
        error: 'Error deleting plan',
        message: error.message,
      };
    }
  }
}
