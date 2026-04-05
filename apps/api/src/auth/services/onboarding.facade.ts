import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  CompleteOnboardingStepDto,
  OnboardingAnalyticsDto,
  SchoolSetupDto,
  SelectUserRoleDto,
  UpdateOnboardingStepDto,
  UpdateProfileDto,
} from '../dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Injectable()
export class OnboardingFacade {
  constructor(private readonly onboardingService: OnboardingService) {}

  private getUserId(req: Request): string {
    return String(req.user['sub'] || req.user['_id']);
  }

  async getOnboardingStatus(req: Request) {
    const userId = this.getUserId(req);
    const status = await this.onboardingService.getOnboardingStatus(userId);
    return {
      success: true,
      data: status,
    };
  }

  async initializeOnboarding(req: Request) {
    const userId = this.getUserId(req);
    const onboardingProgress =
      await this.onboardingService.initializeOnboarding(userId);
    return {
      success: true,
      data: onboardingProgress,
      message: 'Onboarding initialized successfully',
    };
  }

  async updateOnboardingStep(
    req: Request,
    updateStepDto: UpdateOnboardingStepDto,
  ) {
    const userId = this.getUserId(req);
    const onboardingProgress = await this.onboardingService.updateOnboardingStep(
      userId,
      updateStepDto,
    );
    return {
      success: true,
      data: onboardingProgress,
      message: 'Onboarding step updated successfully',
    };
  }

  async completeOnboardingStep(
    req: Request,
    completeStepDto: CompleteOnboardingStepDto,
  ) {
    const userId = this.getUserId(req);
    const onboardingProgress =
      await this.onboardingService.completeOnboardingStep(
        userId,
        completeStepDto,
      );
    return {
      success: true,
      data: onboardingProgress,
      message: 'Onboarding step completed successfully',
    };
  }

  async updateProfile(req: Request, updateProfileDto: UpdateProfileDto) {
    const userId = this.getUserId(req);
    const user = await this.onboardingService.updateProfile(
      userId,
      updateProfileDto,
    );
    return {
      success: true,
      data: {
        id: user._id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        profileImageUrl: user.profileImageUrl,
        bio: user.bio,
        profileCompletionPercentage: user.profileCompletionPercentage,
      },
      message: 'Profile updated successfully',
    };
  }

  async selectUserRole(req: Request, selectRoleDto: SelectUserRoleDto) {
    const userId = this.getUserId(req);
    const user = await this.onboardingService.selectUserRole(
      userId,
      selectRoleDto,
    );
    return {
      success: true,
      data: {
        id: user._id,
        role: user.role,
        name: user.name,
        email: user.email,
      },
      message: 'User role selected successfully',
    };
  }

  async setupSchool(req: Request, schoolSetupDto: SchoolSetupDto) {
    const userId = this.getUserId(req);
    const school = await this.onboardingService.setupSchool(
      userId,
      schoolSetupDto,
    );
    return {
      success: true,
      data: {
        id: school._id,
        name: school.name,
        description: school.description,
        logoUrl: school.logoUrl,
        isPublic: school.isPublic,
        address: school.address,
        phone: school.phone,
        website: school.website,
      },
      message: 'School setup completed successfully',
    };
  }

  async logAnalyticsEvent(req: Request, analyticsDto: OnboardingAnalyticsDto) {
    const userId = this.getUserId(req);
    const result = await this.onboardingService.logAnalyticsEvent(
      userId,
      analyticsDto,
    );
    return {
      success: true,
      data: result,
      message: 'Analytics event logged successfully',
    };
  }

  async skipOnboarding(req: Request, body: { reason?: string } = {}) {
    const userId = this.getUserId(req);
    const result = await this.onboardingService.skipOnboarding(
      userId,
      body.reason,
    );
    return {
      success: true,
      data: result,
      message: 'Onboarding skipped successfully',
    };
  }
}
