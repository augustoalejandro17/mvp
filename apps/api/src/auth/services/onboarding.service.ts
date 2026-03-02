import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, OnboardingStep, UserRole } from '../schemas/user.schema';
import { School } from '../../schools/schemas/school.schema';
import {
  UpdateOnboardingStepDto,
  CompleteOnboardingStepDto,
  UpdateProfileDto,
  SelectUserRoleDto,
  OnboardingAnalyticsDto,
  SchoolSetupDto,
} from '../dto/onboarding.dto';
import { AuditService } from '../../audit/audit.service';
import { ProductAnalyticsService } from '../../product-analytics/product-analytics.service';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    private auditService: AuditService,
    private productAnalyticsService: ProductAnalyticsService,
  ) {}

  async getOnboardingStatus(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select(
        'hasOnboarded onboardingProgress role profileCompletionPercentage',
      );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      hasOnboarded: user.hasOnboarded,
      onboardingProgress: user.onboardingProgress,
      profileCompletion: user.profileCompletionPercentage,
      userRole: user.role,
      needsOnboarding: !user.hasOnboarded,
    };
  }

  async initializeOnboarding(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only initialize if not already started
    if (!user.onboardingProgress || !user.onboardingProgress.startedAt) {
      user.onboardingProgress = {
        currentStep: OnboardingStep.WELCOME,
        completedSteps: [],
        startedAt: new Date(),
        isCompleted: false,
        stepData: new Map(),
      };

      await user.save();
      this.logger.log(`Onboarding initialized for user ${userId}`);
      await this.productAnalyticsService.trackEvent({
        event: 'onboarding_started',
        userId,
      });
    }

    return user.onboardingProgress;
  }

  async updateOnboardingStep(
    userId: string,
    updateStepDto: UpdateOnboardingStepDto,
  ) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Initialize onboarding if not started
    if (!user.onboardingProgress) {
      await this.initializeOnboarding(userId);
    }

    user.onboardingProgress.currentStep = updateStepDto.currentStep;

    if (updateStepDto.stepData) {
      user.onboardingProgress.stepData = new Map(
        Object.entries(updateStepDto.stepData),
      );
    }

    await user.save();

    this.logger.log(
      `Onboarding step updated for user ${userId}: ${updateStepDto.currentStep}`,
    );
    return user.onboardingProgress;
  }

  async completeOnboardingStep(
    userId: string,
    completeStepDto: CompleteOnboardingStepDto,
  ) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.onboardingProgress) {
      await this.initializeOnboarding(userId);
    }

    // Add step to completed steps if not already completed
    if (
      !user.onboardingProgress.completedSteps.includes(completeStepDto.step)
    ) {
      user.onboardingProgress.completedSteps.push(completeStepDto.step);
    }

    // Store step data if provided
    if (completeStepDto.stepData) {
      const stepDataObj = Object.fromEntries(
        user.onboardingProgress.stepData || [],
      );
      Object.assign(stepDataObj, completeStepDto.stepData);
      user.onboardingProgress.stepData = new Map(Object.entries(stepDataObj));
    }

    // Move to next step
    const nextStep = this.getNextStep(completeStepDto.step, user.role);
    if (nextStep) {
      user.onboardingProgress.currentStep = nextStep;
    } else {
      // Onboarding completed
      user.onboardingProgress.currentStep = OnboardingStep.COMPLETED;
      user.onboardingProgress.isCompleted = true;
      user.onboardingProgress.completedAt = new Date();
      user.hasOnboarded = true;
    }

    // Update profile completion percentage
    user.profileCompletionPercentage = this.calculateProfileCompletion(user);

    await user.save();
    if (user.onboardingProgress.isCompleted || user.hasOnboarded) {
      await this.productAnalyticsService.trackEvent({
        event: 'onboarding_completed',
        userId,
      });
    }

    this.logger.log(
      `Onboarding step completed for user ${userId}: ${completeStepDto.step}`,
    );
    return user.onboardingProgress;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update profile fields
    if (updateProfileDto.firstName) user.firstName = updateProfileDto.firstName;
    if (updateProfileDto.lastName) user.lastName = updateProfileDto.lastName;
    if (updateProfileDto.dateOfBirth)
      user.dateOfBirth = new Date(updateProfileDto.dateOfBirth);
    if (updateProfileDto.phone) user.phone = updateProfileDto.phone;
    if (updateProfileDto.bio) user.bio = updateProfileDto.bio;
    if (updateProfileDto.profileImageUrl)
      user.profileImageUrl = updateProfileDto.profileImageUrl;

    // Update full name if first or last name changed
    if (updateProfileDto.firstName || updateProfileDto.lastName) {
      user.name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }

    // Recalculate profile completion percentage
    user.profileCompletionPercentage = this.calculateProfileCompletion(user);

    await user.save();
    await this.auditService.log({
      action: 'onboarding_profile_updated',
      actorId: userId,
      targetType: 'user',
      targetId: userId,
      metadata: {
        profileCompletionPercentage: user.profileCompletionPercentage,
      },
    });

    this.logger.log(`Profile updated for user ${userId}`);
    return user;
  }

  async selectUserRole(userId: string, selectRoleDto: SelectUserRoleDto) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.role = selectRoleDto.role;
    await user.save();
    await this.auditService.log({
      action: 'onboarding_role_selected',
      actorId: userId,
      targetType: 'user',
      targetId: userId,
      metadata: { role: selectRoleDto.role },
    });

    this.logger.log(
      `User role selected for user ${userId}: ${selectRoleDto.role}`,
    );
    return user;
  }

  async setupSchool(userId: string, schoolSetupDto: SchoolSetupDto) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.SCHOOL_OWNER) {
      throw new BadRequestException('Only school owners can setup schools');
    }

    // Create new school
    const school = new this.schoolModel({
      name: schoolSetupDto.name,
      description: schoolSetupDto.description || '',
      logoUrl: schoolSetupDto.logoUrl,
      isPublic: schoolSetupDto.isPublic || false,
      address: schoolSetupDto.address,
      phone: schoolSetupDto.phone,
      website: schoolSetupDto.website,
      admin: user._id,
      createdAt: new Date(),
    });

    const savedSchool = await school.save();

    // Add school to user's owned schools
    user.ownedSchools.push(savedSchool._id);
    user.schools.push(savedSchool._id);

    // Add school role
    user.schoolRoles.push({
      schoolId: savedSchool._id,
      role: UserRole.SCHOOL_OWNER,
      sede: undefined,
    });

    await user.save();
    await this.auditService.log({
      action: 'school_created_via_onboarding',
      actorId: userId,
      targetType: 'school',
      targetId: savedSchool._id.toString(),
      metadata: {
        schoolName: savedSchool.name,
      },
    });

    this.logger.log(
      `School setup completed for user ${userId}: ${savedSchool.name}`,
    );
    return savedSchool;
  }

  async logAnalyticsEvent(
    userId: string,
    analyticsDto: OnboardingAnalyticsDto,
  ) {
    // This could be extended to integrate with analytics services like Google Analytics, Mixpanel, etc.
    this.logger.log(
      `Onboarding Analytics - User: ${userId}, Event: ${analyticsDto.event}, Step: ${analyticsDto.step}`,
      analyticsDto.metadata,
    );

    await this.productAnalyticsService.trackEvent({
      event: `onboarding_custom_${analyticsDto.event}`,
      userId,
      properties: {
        step: analyticsDto.step,
        ...analyticsDto.metadata,
      },
    });

    return { success: true, event: analyticsDto.event, timestamp: new Date() };
  }

  async skipOnboarding(userId: string, reason?: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.hasOnboarded = true;
    user.onboardingProgress = {
      currentStep: OnboardingStep.COMPLETED,
      completedSteps: [],
      startedAt: user.onboardingProgress?.startedAt || new Date(),
      completedAt: new Date(),
      isCompleted: true,
      stepData: new Map(
        Object.entries({
          skipped: true,
          skipReason: reason || 'User chose to skip',
        }),
      ),
    };

    await user.save();
    await this.productAnalyticsService.trackEvent({
      event: 'onboarding_skipped',
      userId,
      properties: { reason: reason || 'User chose to skip' },
    });

    this.logger.log(
      `Onboarding skipped for user ${userId}. Reason: ${reason || 'No reason provided'}`,
    );
    return { success: true, message: 'Onboarding skipped successfully' };
  }

  private getNextStep(
    currentStep: OnboardingStep,
    userRole: UserRole,
  ): OnboardingStep | null {
    const stepFlow = {
      [OnboardingStep.WELCOME]: OnboardingStep.USER_TYPE_SELECTION,
      [OnboardingStep.USER_TYPE_SELECTION]: OnboardingStep.PROFILE_COMPLETION,
      [OnboardingStep.PROFILE_COMPLETION]: null, // Complete onboarding after profile completion
      [OnboardingStep.SCHOOL_SETUP]: OnboardingStep.QUICK_TOUR, // Keep for backward compatibility
      [OnboardingStep.QUICK_TOUR]: null, // Completed
    };

    return stepFlow[currentStep] || null;
  }

  private calculateProfileCompletion(user: User): number {
    const fields = [
      { field: 'name', weight: 20 },
      { field: 'firstName', weight: 15 },
      { field: 'lastName', weight: 15 },
      { field: 'email', weight: 20 },
      { field: 'dateOfBirth', weight: 10 }, // Optional for all users
      { field: 'phone', weight: 10 },
      { field: 'profileImageUrl', weight: 5 },
      { field: 'bio', weight: 5 },
    ];

    let totalWeight = 0;
    let completedWeight = 0;

    for (const fieldConfig of fields) {
      const { field, weight, roles } = fieldConfig as any;

      // Skip role-specific fields if not applicable
      if (roles && !roles.includes(user.role)) {
        continue;
      }

      totalWeight += weight;

      if (user[field] && user[field].toString().trim() !== '') {
        completedWeight += weight;
      }
    }

    return Math.round((completedWeight / totalWeight) * 100);
  }
}
