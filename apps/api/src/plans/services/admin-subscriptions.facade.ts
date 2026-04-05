import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School } from '../../schools/schemas/school.schema';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { PlansService } from '../plans.service';
import { SubscriptionsService } from '../subscriptions.service';
import { Plan } from '../schemas/plan.schema';
import { Subscription } from '../schemas/subscription.schema';

@Injectable()
export class AdminSubscriptionsFacade {
  private readonly logger = new Logger(
    AdminSubscriptionsFacade.name,
  );

  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<Subscription>,
    @InjectModel(Plan.name) private readonly planModel: Model<Plan>,
    @InjectModel(School.name) private readonly schoolModel: Model<School>,
    private readonly plansService: PlansService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async getAllSubscriptions(status?: string) {
    const query: Record<string, unknown> = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const subscriptions = await this.subscriptionModel
      .find(query)
      .populate('plan')
      .populate('school', 'name')
      .sort({ startDate: -1 })
      .exec();

    const formattedSubscriptions = await Promise.all(
      subscriptions.map(async (subscription) => {
        const school = await this.schoolModel.findOne({
          activeSubscription: subscription._id,
        });

        return {
          id: subscription._id,
          schoolName: school ? school.name : 'Unknown School',
          schoolId: school ? school._id : null,
          planName: subscription.plan
            ? (subscription.plan as any).name
            : 'Unknown Plan',
          planType: subscription.plan
            ? (subscription.plan as any).type
            : 'Unknown',
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          currentStorageGb: subscription.currentStorageGb || 0,
          currentStreamingMinutes: subscription.currentStreamingMinutes || 0,
        };
      }),
    );

    return {
      subscriptions: formattedSubscriptions,
      totalCount: formattedSubscriptions.length,
    };
  }

  async testDatabase() {
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
  }

  async getAllPlans(active?: string) {
    const query: Record<string, unknown> = {};
    if (active === 'true') {
      query.isActive = true;
    } else if (active === 'false') {
      query.isActive = false;
    }

    const plans = await this.planModel
      .find(query)
      .sort({ monthlyPriceCents: 1, name: 1 })
      .exec();

    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        const subscriptionsCount = await this.subscriptionModel.countDocuments({
          plan: plan._id,
        });

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
        const teachersCount = plan.teachers || 2;
        const concurrentCourses =
          plan.maxConcurrentCoursesPerStudent || plan.maxCoursesPerUser || 1;

        return {
          _id: plan._id,
          id: plan._id,
          name: plan.name,
          type: plan.type,
          description: plan.description,
          price: priceCents,
          isActive: plan.isActive !== false,
          studentSeats: students,
          teachers: teachersCount,
          maxConcurrentCoursesPerStudent: concurrentCourses,
          storageGb: storage,
          streamingHours: streaming,
          features: plan.features || [],
          subscriptionsCount,
        };
      }),
    );

    this.logger.log('Returning formatted plans to frontend');
    return {
      plans: plansWithStats,
      totalCount: plansWithStats.length,
    };
  }

  async getPlanById(id: string) {
    return this.plansService.findOne(id);
  }

  async createPlan(planData: CreatePlanDto) {
    const newPlan = new this.planModel(planData);
    const savedPlan = await newPlan.save();

    return {
      success: true,
      plan: savedPlan,
    };
  }

  async updatePlan(id: string, planData: UpdatePlanDto) {
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
  }

  async deletePlan(id: string) {
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
  }

  async getSubscriptionById(id: string) {
    return this.subscriptionsService.findOne(id);
  }

  async getSubscriptionBySchool(schoolId: string) {
    return this.subscriptionsService.findBySchool(schoolId);
  }

  async updateSubscription(
    id: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.update(id, updateSubscriptionDto);
  }

  async addExtraResources(
    id: string,
    extraResources: NonNullable<
      UpdateSubscriptionDto['approvedExtraResources']
    >,
  ) {
    const updateDto: UpdateSubscriptionDto = {
      approvedExtraResources: extraResources,
    };

    return this.subscriptionsService.update(id, updateDto);
  }

  async cancelSubscription(id: string) {
    return this.subscriptionsService.remove(id);
  }
}
