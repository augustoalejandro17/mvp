import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  UseGuards, 
  Req, 
  HttpStatus, 
  Logger,
  Query
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OnboardingService } from '../services/onboarding.service';
import { 
  UpdateOnboardingStepDto, 
  CompleteOnboardingStepDto, 
  UpdateProfileDto, 
  SelectUserRoleDto,
  OnboardingAnalyticsDto,
  SchoolSetupDto
} from '../dto/onboarding.dto';

@Controller('auth/onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  async getOnboardingStatus(@Req() req: Request) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const status = await this.onboardingService.getOnboardingStatus(userId);
      this.logger.log(`Onboarding status requested for user: ${userId}`);
      return {
        success: true,
        data: status
      };
    } catch (error) {
      this.logger.error(`Error getting onboarding status for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('initialize')
  async initializeOnboarding(@Req() req: Request) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const onboardingProgress = await this.onboardingService.initializeOnboarding(userId);
      this.logger.log(`Onboarding initialized for user: ${userId}`);
      return {
        success: true,
        data: onboardingProgress,
        message: 'Onboarding initialized successfully'
      };
    } catch (error) {
      this.logger.error(`Error initializing onboarding for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put('step')
  async updateOnboardingStep(@Req() req: Request, @Body() updateStepDto: UpdateOnboardingStepDto) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const onboardingProgress = await this.onboardingService.updateOnboardingStep(userId, updateStepDto);
      this.logger.log(`Onboarding step updated for user: ${userId} to step: ${updateStepDto.currentStep}`);
      return {
        success: true,
        data: onboardingProgress,
        message: 'Onboarding step updated successfully'
      };
    } catch (error) {
      this.logger.error(`Error updating onboarding step for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('step/complete')
  async completeOnboardingStep(@Req() req: Request, @Body() completeStepDto: CompleteOnboardingStepDto) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const onboardingProgress = await this.onboardingService.completeOnboardingStep(userId, completeStepDto);
      this.logger.log(`Onboarding step completed for user: ${userId}, step: ${completeStepDto.step}`);
      return {
        success: true,
        data: onboardingProgress,
        message: 'Onboarding step completed successfully'
      };
    } catch (error) {
      this.logger.error(`Error completing onboarding step for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put('profile')
  async updateProfile(@Req() req: Request, @Body() updateProfileDto: UpdateProfileDto) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const user = await this.onboardingService.updateProfile(userId, updateProfileDto);
      this.logger.log(`Profile updated for user: ${userId}`);
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
          profileCompletionPercentage: user.profileCompletionPercentage
        },
        message: 'Profile updated successfully'
      };
    } catch (error) {
      this.logger.error(`Error updating profile for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('role/select')
  async selectUserRole(@Req() req: Request, @Body() selectRoleDto: SelectUserRoleDto) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const user = await this.onboardingService.selectUserRole(userId, selectRoleDto);
      this.logger.log(`User role selected for user: ${userId}, role: ${selectRoleDto.role}`);
      return {
        success: true,
        data: {
          id: user._id,
          role: user.role,
          name: user.name,
          email: user.email
        },
        message: 'User role selected successfully'
      };
    } catch (error) {
      this.logger.error(`Error selecting user role for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('school/setup')
  async setupSchool(@Req() req: Request, @Body() schoolSetupDto: SchoolSetupDto) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const school = await this.onboardingService.setupSchool(userId, schoolSetupDto);
      this.logger.log(`School setup completed for user: ${userId}, school: ${school.name}`);
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
          website: school.website
        },
        message: 'School setup completed successfully'
      };
    } catch (error) {
      this.logger.error(`Error setting up school for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('analytics')
  async logAnalyticsEvent(@Req() req: Request, @Body() analyticsDto: OnboardingAnalyticsDto) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const result = await this.onboardingService.logAnalyticsEvent(userId, analyticsDto);
      return {
        success: true,
        data: result,
        message: 'Analytics event logged successfully'
      };
    } catch (error) {
      this.logger.error(`Error logging analytics event for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('skip')
  async skipOnboarding(@Req() req: Request, @Body() body: { reason?: string } = {}) {
    const userId = req.user['sub'] || req.user['_id'];
    
    try {
      const result = await this.onboardingService.skipOnboarding(userId, body.reason);
      this.logger.log(`Onboarding skipped for user: ${userId}, reason: ${body.reason || 'No reason provided'}`);
      return {
        success: true,
        data: result,
        message: 'Onboarding skipped successfully'
      };
    } catch (error) {
      this.logger.error(`Error skipping onboarding for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }
} 