import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  IsMongoId,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { PointsActionType } from '../schemas/user-points.schema';

export class AwardPointsDto {
  @IsMongoId({ message: 'Invalid user ID' })
  userId: string;

  @IsMongoId({ message: 'Invalid school ID' })
  schoolId: string;

  @IsNumber()
  @Min(1, { message: 'Points must be positive' })
  @Max(10000, { message: 'Points award too high' })
  points: number;

  @IsEnum(PointsActionType, { message: 'Invalid action type' })
  actionType: PointsActionType;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @IsMongoId({ message: 'Invalid course ID' })
  @IsOptional()
  courseId?: string;

  @IsMongoId({ message: 'Invalid class ID' })
  @IsOptional()
  classId?: string;

  @IsMongoId({ message: 'Invalid badge ID' })
  @IsOptional()
  badgeId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  sendNotification?: boolean;
}

export class DeductPointsDto {
  @IsMongoId({ message: 'Invalid user ID' })
  userId: string;

  @IsMongoId({ message: 'Invalid school ID' })
  schoolId: string;

  @IsNumber()
  @Min(1, { message: 'Points must be positive' })
  points: number;

  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  reason: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateStreakDto {
  @IsMongoId({ message: 'Invalid user ID' })
  userId: string;

  @IsMongoId({ message: 'Invalid school ID' })
  schoolId: string;

  @IsNumber()
  @Min(0, { message: 'Streak must be non-negative' })
  streak: number;

  @IsBoolean()
  @IsOptional()
  resetStreak?: boolean;
}

export class GetUserPointsDto {
  @IsMongoId({ message: 'Invalid user ID' })
  userId: string;

  @IsMongoId({ message: 'Invalid school ID' })
  schoolId: string;

  @IsBoolean()
  @IsOptional()
  includeTransactions?: boolean;

  @IsBoolean()
  @IsOptional()
  includeRankings?: boolean;
}

export class GetLeaderboardDto {
  @IsEnum(['global', 'school', 'course', 'category'], {
    message: 'Invalid leaderboard type',
  })
  type: string;

  @IsEnum(['all_time', 'yearly', 'monthly', 'weekly', 'daily'], {
    message: 'Invalid period',
  })
  period: string;

  @IsMongoId({ message: 'Invalid school ID' })
  @IsOptional()
  schoolId?: string;

  @IsMongoId({ message: 'Invalid course ID' })
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number;

  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;
}

export class TeacherRewardDto {
  @IsMongoId({ message: 'Invalid student ID' })
  studentId: string;

  @IsMongoId({ message: 'Invalid school ID' })
  schoolId: string;

  @IsNumber()
  @Min(1, { message: 'Points must be positive' })
  @Max(1000, { message: 'Teacher reward too high' })
  points: number;

  @IsString()
  @IsNotEmpty({ message: 'Reason is required' })
  reason: string;

  @IsMongoId({ message: 'Invalid course ID' })
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsBoolean()
  @IsOptional()
  sendNotification?: boolean;
}

export class UserProgressDto {
  @IsMongoId({ message: 'Invalid user ID' })
  userId: string;

  @IsMongoId({ message: 'Invalid school ID' })
  schoolId: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  includeBadges?: boolean;

  @IsBoolean()
  @IsOptional()
  includeTransactions?: boolean;

  @IsBoolean()
  @IsOptional()
  includeComparisons?: boolean;
}
