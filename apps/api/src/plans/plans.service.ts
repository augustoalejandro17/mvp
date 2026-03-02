import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Plan, PlanDocument, PlanType } from './schemas/plan.schema';
import { School, SchoolDocument } from '../schools/schemas/school.schema';
import {
  Overage,
  OverageDocument,
  OverageType,
} from './schemas/overage.schema';
import { User, UserRole } from '../auth/schemas/user.schema';
import { UsageTracking } from '../usage/schemas/usage-tracking.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import {
  PLAN_CONFIGS,
  getPlanConfig,
  formatPriceFromCents,
  calculateOveragePrice,
  PlanConfig,
} from './constants/plan-config.constants';

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    @InjectModel(Overage.name) private overageModel: Model<OverageDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(UsageTracking.name)
    private usageTrackingModel: Model<UsageTracking>,
  ) {
    // Initialize default plans using authoritative pricing table
    this.initDefaultPlans();
  }

  async initDefaultPlans() {
    const plansCount = await this.planModel.countDocuments().exec();

    if (plansCount === 0) {
      // Use authoritative pricing table to create plans
      const defaultPlans = Object.values(PLAN_CONFIGS).map((config) => ({
        name: config.name,
        type: config.type,
        description: `Plan ${config.name} for academies with up to ${config.studentSeats} users`,

        // New authoritative fields
        studentSeats: config.studentSeats,
        teachers: config.teachers,
        maxConcurrentCoursesPerStudent: config.maxConcurrentCoursesPerStudent,
        storageGB: config.storageGB,
        streamingHoursPerMonth: config.streamingHoursPerMonth,
        monthlyPriceCents: config.monthlyPriceCents,
        overageStudentCents: config.overUsageUnitPrices.studentCents,
        overageStorageCentsPerGB: config.overUsageUnitPrices.storageCentsPerGB,
        overageStreamingCentsPerHour:
          config.overUsageUnitPrices.streamingCentsPerHour,
        features: Array.from(config.features),

        // Legacy fields for backward compatibility
        maxUsers: config.studentSeats,
        maxStorageGb: config.storageGB,
        maxStreamingMinutesPerMonth: config.streamingHoursPerMonth * 60, // Convert hours to minutes
        maxCoursesPerUser: config.maxConcurrentCoursesPerStudent,
        monthlyPrice: config.monthlyPriceCents / 100,
        price: config.monthlyPriceCents / 100,
        isDefault: config.type === PlanType.BASIC,
        extraUserPrice: config.overUsageUnitPrices.studentCents / 100,
        extraStorageGbPrice: config.overUsageUnitPrices.storageCentsPerGB / 100,
        extraStreamingMinutesPrice:
          config.overUsageUnitPrices.streamingCentsPerHour / 60 / 100, // Convert hour to minute pricing
        extraCoursePerUserPrice: 5.0, // Default value
      }));

      await this.planModel.insertMany(defaultPlans);
      console.log(
        `Initialized ${defaultPlans.length} default plans with authoritative pricing`,
      );
    }
  }

  async create(createPlanDto: CreatePlanDto): Promise<Plan> {
    const createdPlan = new this.planModel(createPlanDto);
    return createdPlan.save();
  }

  async findAll(): Promise<Plan[]> {
    return this.planModel.find({ isActive: true }).exec();
  }

  async findOne(id: string): Promise<Plan> {
    return this.planModel.findById(id).exec();
  }

  async findDefault(): Promise<Plan> {
    return this.planModel.findOne({ isDefault: true, isActive: true }).exec();
  }

  async findByType(type: PlanType): Promise<Plan> {
    return this.planModel.findOne({ type, isActive: true }).exec();
  }

  async update(id: string, updatePlanDto: UpdatePlanDto): Promise<Plan> {
    return this.planModel
      .findByIdAndUpdate(id, updatePlanDto, { new: true })
      .exec();
  }

  async remove(id: string): Promise<any> {
    // En lugar de eliminar, marcamos como inactivo
    return this.planModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();
  }

  // ===== PLAN VALIDATION & LIMITS =====

  /**
   * Validates if a user can be added to a school based on plan limits
   */
  async validateUserCreation(
    schoolId: string,
  ): Promise<{ allowed: boolean; message: string }> {
    const school = await this.schoolModel
      .findById(schoolId)
      .populate('planId')
      .exec();
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const plan = school.planId as any;
    const totalLimit = plan.studentSeats + school.extraSeats;

    if (school.currentSeats >= totalLimit) {
      // Record overage
      await this.recordOverage(
        schoolId,
        school.planId.toString(),
        OverageType.STUDENT,
        1,
      );
      return {
        allowed: false,
        message: `User limit exceeded. Plan allows ${totalLimit} users, currently have ${school.currentSeats}`,
      };
    }

    return { allowed: true, message: 'User can be created' };
  }

  /**
   * Validates if file upload is allowed based on storage limits
   */
  async validateFileUpload(
    schoolId: string,
    fileSizeGB: number,
  ): Promise<{ allowed: boolean; message: string }> {
    const school = await this.schoolModel
      .findById(schoolId)
      .populate('planId')
      .exec();
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const plan = school.planId as any;
    const totalLimit = plan.storageGB + school.extraStorageGB;
    const newUsage = school.usedStorageGB + fileSizeGB;

    if (newUsage > totalLimit) {
      const overage = newUsage - totalLimit;
      // Record overage
      await this.recordOverage(
        schoolId,
        school.planId.toString(),
        OverageType.STORAGE,
        overage,
      );
      return {
        allowed: false,
        message: `Storage limit exceeded. Plan allows ${totalLimit}GB, would use ${newUsage}GB`,
      };
    }

    return { allowed: true, message: 'File upload allowed' };
  }

  /**
   * Validates if streaming session can start
   */
  async validateStreamingSession(
    schoolId: string,
    estimatedHours: number,
  ): Promise<{ allowed: boolean; message: string }> {
    const school = await this.schoolModel
      .findById(schoolId)
      .populate('planId')
      .exec();
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const plan = school.planId as any;
    const totalLimit = plan.streamingHoursPerMonth + school.extraStreamingHours;
    const newUsage = school.usedStreamingHours + estimatedHours;

    if (newUsage > totalLimit) {
      const overage = newUsage - totalLimit;
      // Record overage
      await this.recordOverage(
        schoolId,
        school.planId.toString(),
        OverageType.STREAMING,
        overage,
      );
      return {
        allowed: false,
        message: `Streaming limit exceeded. Plan allows ${totalLimit} hours/month, would use ${newUsage} hours`,
      };
    }

    return { allowed: true, message: 'Streaming session allowed' };
  }

  /**
   * Validates course enrollment based on concurrent course limits
   */
  async validateCourseEnrollment(
    schoolId: string,
    studentId: string,
  ): Promise<{ allowed: boolean; message: string }> {
    const school = await this.schoolModel
      .findById(schoolId)
      .populate('planId')
      .exec();
    if (!school) {
      throw new BadRequestException('School not found');
    }

    const plan = school.planId as any;

    // Count current enrollments for this student in this school
    // This would need to be implemented based on your enrollment logic
    const currentEnrollments = 0; // TODO: Implement actual count

    if (currentEnrollments >= plan.maxConcurrentCoursesPerStudent) {
      return {
        allowed: false,
        message: `Course enrollment limit exceeded. Plan allows ${plan.maxConcurrentCoursesPerStudent} concurrent courses per student`,
      };
    }

    return { allowed: true, message: 'Course enrollment allowed' };
  }

  // ===== USAGE TRACKING =====

  /**
   * Updates school usage counters
   */
  async updateSchoolUsage(
    schoolId: string,
    usage: {
      seats?: number;
      storageGB?: number;
      streamingHours?: number;
    },
  ): Promise<void> {
    const updateData: any = {};

    if (usage.seats !== undefined) updateData.currentSeats = usage.seats;
    if (usage.storageGB !== undefined)
      updateData.usedStorageGB = usage.storageGB;
    if (usage.streamingHours !== undefined)
      updateData.usedStreamingHours = usage.streamingHours;

    await this.schoolModel.findByIdAndUpdate(schoolId, updateData).exec();
  }

  /**
   * Records overage for billing
   */
  private async recordOverage(
    schoolId: string,
    planId: string,
    type: OverageType,
    amount: number,
  ): Promise<void> {
    const school = await this.schoolModel
      .findById(schoolId)
      .populate('planId')
      .exec();
    const plan = school.planId as any;

    let unitPriceCents: number;

    switch (type) {
      case OverageType.STUDENT:
        unitPriceCents = plan.overageStudentCents;
        break;
      case OverageType.STORAGE:
        unitPriceCents = plan.overageStorageCentsPerGB;
        break;
      case OverageType.STREAMING:
        unitPriceCents = plan.overageStreamingCentsPerHour;
        break;
      default:
        throw new Error(`Invalid overage type: ${type}`);
    }

    const totalPriceCents = unitPriceCents * amount;
    const now = new Date();

    await this.overageModel.create({
      schoolId,
      planId,
      type,
      overageAmount: amount,
      unitPriceCents,
      totalPriceCents,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      recordedAt: now,
    });
  }

  // ===== PLAN CONFIGURATION ACCESS =====

  /**
   * Gets plan configuration from constants
   */
  getPlanConfiguration(planType: PlanType): PlanConfig {
    return getPlanConfig(planType);
  }

  /**
   * Gets all plan configurations
   */
  getAllPlanConfigurations(): PlanConfig[] {
    return Object.values(PLAN_CONFIGS);
  }

  /**
   * Formats price from cents to display format
   */
  formatPrice(cents: number): string {
    return formatPriceFromCents(cents);
  }

  // ===== SUPER ADMIN METHODS =====

  /**
   * Assigns a plan to an academy (super admin only)
   */
  async assignPlanToAcademy(
    academyId: string,
    planType: PlanType,
  ): Promise<any> {
    const plan = await this.planModel
      .findOne({ type: planType, isActive: true })
      .exec();
    if (!plan) {
      throw new BadRequestException(
        `Plan type ${planType} not found or inactive`,
      );
    }

    const academy = await this.schoolModel.findById(academyId).exec();
    if (!academy) {
      throw new BadRequestException('Academy not found');
    }

    await this.schoolModel
      .findByIdAndUpdate(academyId, {
        planId: plan._id,
      })
      .exec();

    return {
      success: true,
      message: `Plan ${plan.name} assigned to academy ${academy.name}`,
      planDetails: {
        name: plan.name,
        type: plan.type,
        monthlyPrice: formatPriceFromCents(plan.monthlyPriceCents),
        limits: {
          studentSeats: plan.studentSeats,
          teachers: plan.teachers,
          storageGB: plan.storageGB,
          streamingHours: plan.streamingHoursPerMonth,
        },
      },
    };
  }

  /**
   * Assigns a plan to an academy by plan ID (super admin only)
   */
  async assignPlanToAcademyById(
    academyId: string,
    planId: string,
  ): Promise<any> {
    const plan = await this.planModel.findById(planId).exec();
    if (!plan || !plan.isActive) {
      throw new BadRequestException(`Plan not found or inactive`);
    }

    const academy = await this.schoolModel.findById(academyId).exec();
    if (!academy) {
      throw new BadRequestException('Academy not found');
    }

    await this.schoolModel
      .findByIdAndUpdate(academyId, {
        planId: plan._id,
      })
      .exec();

    return {
      success: true,
      message: `Plan ${plan.name} assigned to academy ${academy.name}`,
      planDetails: {
        name: plan.name,
        type: plan.type,
        monthlyPrice: formatPriceFromCents(
          plan.monthlyPriceCents ||
            plan.monthlyPrice * 100 ||
            plan.price * 100 ||
            0,
        ),
        limits: {
          studentSeats: plan.studentSeats || plan.maxUsers || 0,
          teachers: plan.teachers || 2,
          storageGB: plan.storageGB || plan.maxStorageGb || 0,
          streamingHours:
            plan.streamingHoursPerMonth ||
            plan.maxStreamingMinutesPerMonth / 60 ||
            0,
        },
      },
    };
  }

  /**
   * Grants extra resources to an academy (super admin only)
   */
  async grantExtraResources(
    academyId: string,
    resources: {
      extraSeats?: number;
      extraStorageGB?: number;
      extraStreamingHours?: number;
    },
  ): Promise<any> {
    const academy = await this.schoolModel.findById(academyId).exec();
    if (!academy) {
      throw new BadRequestException('Academy not found');
    }

    const updateData: any = {};
    if (resources.extraSeats !== undefined)
      updateData.extraSeats = resources.extraSeats;
    if (resources.extraStorageGB !== undefined)
      updateData.extraStorageGB = resources.extraStorageGB;
    if (resources.extraStreamingHours !== undefined)
      updateData.extraStreamingHours = resources.extraStreamingHours;

    await this.schoolModel.findByIdAndUpdate(academyId, updateData).exec();

    return {
      success: true,
      message: 'Extra resources granted successfully',
      grantedResources: resources,
      academyName: academy.name,
    };
  }

  /**
   * Gets academy plan details and current usage
   */
  async getAcademyPlanDetails(academyId: string): Promise<any> {
    const academy = await this.schoolModel
      .findById(academyId)
      .populate('planId')
      .exec();
    if (!academy) {
      throw new BadRequestException('Academy not found');
    }

    const plan = academy.planId as any;

    // Handle academy without a plan
    if (!plan) {
      return {
        academy: {
          id: academy._id,
          name: academy.name,
        },
        plan: null,
        message: 'No plan assigned to this academy',
        hasPlan: false,
      };
    }

    // Calculate current seats dynamically (only registered users count as seats)
    // Count all registered users with platform access (these count as paid seats)
    const registeredUsersCount = await this.userModel
      .countDocuments({
        schools: academy._id,
        role: { $in: ['student', 'teacher', 'school_owner', 'administrative'] },
        email: { $exists: true },
        password: { $exists: true },
      })
      .exec();

    const calculatedCurrentSeats = registeredUsersCount;

    // Update the currentSeats in the database if it's different
    if (academy.currentSeats !== calculatedCurrentSeats) {
      await this.schoolModel
        .findByIdAndUpdate(academyId, {
          currentSeats: calculatedCurrentSeats,
        })
        .exec();
    }

    // Get real usage data from usage tracking collection for current month
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    const usageDoc = await this.usageTrackingModel
      .findOne({
        school: new Types.ObjectId(academyId),
        month: currentMonth,
        year: currentYear,
      })
      .exec();

    // Get real storage and streaming usage from usage tracking
    const realStorageGB = usageDoc ? usageDoc.totalStorageGB : 0;
    const realStreamingMinutes = usageDoc ? usageDoc.totalStreamingMinutes : 0;
    const realStreamingHours = realStreamingMinutes / 60; // Convert minutes to hours

    return {
      academy: {
        id: academy._id,
        name: academy.name,
      },
      plan: {
        _id: plan._id,
        name: plan.name,
        type: plan.type,
        monthlyPrice: formatPriceFromCents(
          plan.monthlyPriceCents ||
            plan.monthlyPrice * 100 ||
            plan.price * 100 ||
            0,
        ),
      },
      limits: {
        studentSeats:
          (plan.studentSeats || plan.maxUsers || 0) + (academy.extraSeats || 0),
        teachers: plan.teachers || 2,
        storageGB:
          (plan.storageGB || plan.maxStorageGb || 0) +
          (academy.extraStorageGB || 0),
        streamingHours:
          (plan.streamingHoursPerMonth ||
            plan.maxStreamingMinutesPerMonth / 60 ||
            0) + (academy.extraStreamingHours || 0),
      },
      usage: {
        currentSeats: calculatedCurrentSeats,
        usedStorageGB: realStorageGB,
        usedStreamingHours: realStreamingHours,
      },
      extras: {
        seats: academy.extraSeats || 0,
        storageGB: academy.extraStorageGB || 0,
        streamingHours: academy.extraStreamingHours || 0,
      },
      hasPlan: true,
    };
  }

  /**
   * Gets academy overage history
   */
  async getAcademyOverages(academyId: string): Promise<any> {
    const overages = await this.overageModel
      .find({ schoolId: academyId })
      .sort({ recordedAt: -1 })
      .exec();

    const totalOverageCosts = overages.reduce(
      (sum, overage) => sum + overage.totalPriceCents,
      0,
    );

    return {
      overages: overages.map((overage) => ({
        type: overage.type,
        amount: overage.overageAmount,
        unitPrice: formatPriceFromCents(overage.unitPriceCents),
        totalCost: formatPriceFromCents(overage.totalPriceCents),
        month: overage.month,
        year: overage.year,
        recordedAt: overage.recordedAt,
        billed: overage.billed,
      })),
      totalCost: formatPriceFromCents(totalOverageCosts),
      summary: {
        totalOverages: overages.length,
        unbilledOverages: overages.filter((o) => !o.billed).length,
      },
    };
  }

  /**
   * Validates all plan limits for an academy
   */
  async validateAllLimits(academyId: string): Promise<any> {
    const userValidation = await this.validateUserCreation(academyId);
    const storageValidation = await this.validateFileUpload(academyId, 0); // Check current usage
    const streamingValidation = await this.validateStreamingSession(
      academyId,
      0,
    ); // Check current usage

    return {
      academyId,
      validations: {
        users: userValidation,
        storage: storageValidation,
        streaming: streamingValidation,
      },
      overallStatus:
        userValidation.allowed &&
        storageValidation.allowed &&
        streamingValidation.allowed
          ? 'WITHIN_LIMITS'
          : 'EXCEEDING_LIMITS',
    };
  }

  /**
   * Resets usage counters for new billing period
   */
  async resetUsageCounters(academyId: string): Promise<any> {
    const academy = await this.schoolModel.findById(academyId).exec();
    if (!academy) {
      throw new BadRequestException('Academy not found');
    }

    await this.schoolModel
      .findByIdAndUpdate(academyId, {
        usedStreamingHours: 0,
        // Note: Storage and seats typically don't reset monthly
      })
      .exec();

    return {
      success: true,
      message: 'Usage counters reset for new billing period',
      academyName: academy.name,
      resetFields: ['usedStreamingHours'],
    };
  }

  /**
   * Check if user has access to manage a specific school
   */
  async checkSchoolAccess(user: any, schoolId: string): Promise<boolean> {
    const school = await this.schoolModel.findById(schoolId).exec();
    if (!school) {
      return false;
    }

    // Super admin has access to all schools
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // School owner has access to schools they own
    if (
      user.role === UserRole.SCHOOL_OWNER &&
      school.admin.toString() === user.sub
    ) {
      return true;
    }

    // Administrative users have access to schools they're assigned to
    if (
      user.role === UserRole.ADMINISTRATIVE &&
      school.administratives &&
      school.administratives.includes(user.sub)
    ) {
      return true;
    }

    return false;
  }
}
