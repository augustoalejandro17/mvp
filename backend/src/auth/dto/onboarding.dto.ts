import { IsString, IsOptional, IsEmail, IsDateString, IsEnum, IsObject, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { OnboardingStep, UserRole } from '../schemas/user.schema';

export class UpdateOnboardingStepDto {
  @IsEnum(OnboardingStep)
  currentStep: OnboardingStep;

  @IsOptional()
  @IsObject()
  stepData?: Record<string, any>;
}

export class CompleteOnboardingStepDto {
  @IsEnum(OnboardingStep)
  step: OnboardingStep;

  @IsOptional()
  @IsObject()
  stepData?: Record<string, any>;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;
}

export class SelectUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class OnboardingAnalyticsDto {
  @IsString()
  event: string;

  @IsEnum(OnboardingStep)
  step: OnboardingStep;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SchoolSetupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  website?: string;
} 