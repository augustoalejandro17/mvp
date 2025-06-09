import { IsOptional, IsString, IsDateString, IsEnum, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum MetricType {
  ATTENDANCE = 'attendance',
  OCCUPANCY = 'occupancy',
  REVENUE = 'revenue',
  NO_SHOW = 'no-show',
  RETENTION = 'retention'
}

export class StatisticsQueryDto {
  @ApiPropertyOptional({ 
    description: 'Start date (YYYY-MM-DD)', 
    example: '2024-01-01' 
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ 
    description: 'End date (YYYY-MM-DD)', 
    example: '2024-01-31' 
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ 
    description: 'Academy/School ID (for super admins)', 
    example: '507f1f77bcf86cd799439011' 
  })
  @IsOptional()
  @IsMongoId()
  academyId?: string;
}

export class MetricQueryDto extends StatisticsQueryDto {
  @ApiProperty({ 
    enum: MetricType, 
    description: 'Type of metric to retrieve',
    example: MetricType.ATTENDANCE 
  })
  @IsEnum(MetricType)
  metric: MetricType;
}

export class CourseMetricQueryDto extends MetricQueryDto {
  @ApiPropertyOptional({ 
    description: 'Specific course ID to filter by', 
    example: '507f1f77bcf86cd799439012' 
  })
  @IsOptional()
  @IsMongoId()
  courseId?: string;
}

// Response DTOs
export class OverviewStatsResponseDto {
  @ApiProperty({ description: 'Date range for the statistics' })
  dateRange: {
    from: string;
    to: string;
  };

  @ApiProperty({ description: 'Total revenue in cents' })
  totalRevenueCents: number;

  @ApiProperty({ description: 'Total students present' })
  totalPresent: number;

  @ApiProperty({ description: 'Total students absent' })
  totalAbsent: number;

  @ApiProperty({ description: 'Overall attendance rate (0-1)' })
  attendanceRate: number;

  @ApiProperty({ description: 'Overall occupancy rate (0-1)' })
  occupancyRate: number;

  @ApiProperty({ description: 'No-show percentage (0-1)' })
  noShowRate: number;

  @ApiProperty({ description: 'Average retention in days' })
  avgRetentionDays: number;

  @ApiProperty({ description: 'Total active enrollments' })
  totalActive: number;

  @ApiProperty({ description: 'Total dropped in period' })
  totalDropped: number;

  @ApiProperty({ description: 'Daily churn rate (0-1)' })
  churnRate: number;
}

export class DimensionMetricResponseDto {
  @ApiProperty({ description: 'Dimension ID (professor, course, category, or age range)' })
  id: string;

  @ApiProperty({ description: 'Display name for the dimension' })
  name: string;

  @ApiProperty({ description: 'Metric value' })
  value: number;

  @ApiProperty({ description: 'Supporting data for context' })
  context: {
    present?: number;
    absent?: number;
    maxSeats?: number;
    revenueCents?: number;
    active?: number;
    dropped?: number;
  };
}

export class TimeSeriesDataPointDto {
  @ApiProperty({ description: 'Date (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: 'Metric value for this date' })
  value: number;

  @ApiProperty({ description: 'Supporting data for context' })
  context: {
    present?: number;
    absent?: number;
    maxSeats?: number;
    revenueCents?: number;
    active?: number;
    dropped?: number;
  };
}

export class TimeSeriesResponseDto {
  @ApiProperty({ description: 'Metric type' })
  metric: MetricType;

  @ApiProperty({ description: 'Date range' })
  dateRange: {
    from: string;
    to: string;
  };

  @ApiProperty({ description: 'Time series data points', type: [TimeSeriesDataPointDto] })
  data: TimeSeriesDataPointDto[];
}

export class DateRangeDto {
  startDate: Date;

  endDate: Date;
}

// DTO para retención de estudiantes
export class RetentionRateDto {
  courseId: string;

  courseName: string;

  initialEnrollment: number;

  currentEnrollment: number;

  retentionRate: number;

  completedCount: number;

  completionRate: number;
}

// DTO para rendimiento de profesores
export class TeacherPerformanceDto {
  teacherId: string;

  teacherName: string;

  avgRetentionRate: number;

  avgAttendanceRate: number;

  coursesCount: number;

  studentsCount: number;

  satisfaction: number;

  monthlyTrend?: { month: string; retention: number; attendance: number }[];
}

// DTO para ingresos
export class RevenueDto {
  byDate: {
    date: string;
    amount: number;
  }[];

  totalRevenue: number;

  avgDailyRevenue: number;

  nextMonthProjection: number;
}

// DTO para tasa de abandono
export class DropoutRateDto {
  courseId: string;

  courseName: string;

  dropoutRate: number;

  dropoutCount: number;

  criticalPoints: {
    timePoint: number; // days since enrollment
    dropoutCount: number;
  }[];
}

// DTO para demografía por edad
export class AgeDistributionDto {
  under18: number;

  age18to25: number;

  age26to35: number;

  over36: number;

  unknown: number;
}

// DTO para respuesta completa de estadísticas
export class StatisticsResponseDto {
  retentionRates: RetentionRateDto[];

  teacherPerformance: TeacherPerformanceDto[];

  revenue: RevenueDto;

  dropoutRates: DropoutRateDto[];

  overallDropoutRate: number;

  ageDistribution: AgeDistributionDto;
} 