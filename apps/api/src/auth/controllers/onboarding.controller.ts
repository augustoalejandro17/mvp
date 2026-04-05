import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  UpdateOnboardingStepDto,
  CompleteOnboardingStepDto,
  UpdateProfileDto,
  SelectUserRoleDto,
  OnboardingAnalyticsDto,
  SchoolSetupDto,
} from '../dto/onboarding.dto';
import { OnboardingFacade } from '../services/onboarding.facade';

@Controller('auth/onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingFacade: OnboardingFacade,
  ) {}

  @Get('status')
  async getOnboardingStatus(@Req() req: Request) {
    return this.onboardingFacade.getOnboardingStatus(req);
  }

  @Post('initialize')
  async initializeOnboarding(@Req() req: Request) {
    return this.onboardingFacade.initializeOnboarding(req);
  }

  @Put('step')
  async updateOnboardingStep(
    @Req() req: Request,
    @Body() updateStepDto: UpdateOnboardingStepDto,
  ) {
    return this.onboardingFacade.updateOnboardingStep(
      req,
      updateStepDto,
    );
  }

  @Post('step/complete')
  async completeOnboardingStep(
    @Req() req: Request,
    @Body() completeStepDto: CompleteOnboardingStepDto,
  ) {
    return this.onboardingFacade.completeOnboardingStep(
      req,
      completeStepDto,
    );
  }

  @Put('profile')
  async updateProfile(
    @Req() req: Request,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.onboardingFacade.updateProfile(req, updateProfileDto);
  }

  @Post('role/select')
  async selectUserRole(
    @Req() req: Request,
    @Body() selectRoleDto: SelectUserRoleDto,
  ) {
    return this.onboardingFacade.selectUserRole(req, selectRoleDto);
  }

  @Post('school/setup')
  async setupSchool(
    @Req() req: Request,
    @Body() schoolSetupDto: SchoolSetupDto,
  ) {
    return this.onboardingFacade.setupSchool(req, schoolSetupDto);
  }

  @Post('analytics')
  async logAnalyticsEvent(
    @Req() req: Request,
    @Body() analyticsDto: OnboardingAnalyticsDto,
  ) {
    return this.onboardingFacade.logAnalyticsEvent(req, analyticsDto);
  }

  @Post('skip')
  async skipOnboarding(
    @Req() req: Request,
    @Body() body: { reason?: string } = {},
  ) {
    return this.onboardingFacade.skipOnboarding(req, body);
  }
}
