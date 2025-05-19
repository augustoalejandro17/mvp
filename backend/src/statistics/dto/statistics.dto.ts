import { ApiProperty } from '@nestjs/swagger';

export class DateRangeDto {
  @ApiProperty({ description: 'Start date for the query', required: true })
  startDate: Date;

  @ApiProperty({ description: 'End date for the query', required: true })
  endDate: Date;
}

// DTO para retención de estudiantes
export class RetentionRateDto {
  @ApiProperty({ description: 'Course ID' })
  courseId: string;

  @ApiProperty({ description: 'Course name' })
  courseName: string;

  @ApiProperty({ description: 'Initial number of enrolled students' })
  initialEnrollment: number;

  @ApiProperty({ description: 'Current number of active students' })
  currentEnrollment: number;

  @ApiProperty({ description: 'Retention rate as percentage', minimum: 0, maximum: 100 })
  retentionRate: number;

  @ApiProperty({ description: 'Number of students who completed the course' })
  completedCount: number;

  @ApiProperty({ description: 'Completion rate as percentage', minimum: 0, maximum: 100 })
  completionRate: number;
}

// DTO para rendimiento de profesores
export class TeacherPerformanceDto {
  @ApiProperty({ description: 'Teacher ID' })
  teacherId: string;

  @ApiProperty({ description: 'Teacher name' })
  teacherName: string;

  @ApiProperty({ description: 'Average student retention rate across all courses', minimum: 0, maximum: 100 })
  avgRetentionRate: number;

  @ApiProperty({ description: 'Average student attendance rate', minimum: 0, maximum: 100 })
  avgAttendanceRate: number;

  @ApiProperty({ description: 'Total number of courses taught' })
  coursesCount: number;

  @ApiProperty({ description: 'Total number of students taught' })
  studentsCount: number;
}

// DTO para ingresos
export class RevenueDto {
  @ApiProperty({ description: 'Revenue data by date' })
  byDate: {
    date: string;
    amount: number;
  }[];

  @ApiProperty({ description: 'Total revenue in the period' })
  totalRevenue: number;

  @ApiProperty({ description: 'Average daily revenue' })
  avgDailyRevenue: number;

  @ApiProperty({ description: 'Revenue projection for next month' })
  nextMonthProjection: number;
}

// DTO para tasa de abandono
export class DropoutRateDto {
  @ApiProperty({ description: 'Course ID' })
  courseId: string;

  @ApiProperty({ description: 'Course name' })
  courseName: string;

  @ApiProperty({ description: 'Dropout rate as percentage', minimum: 0, maximum: 100 })
  dropoutRate: number;

  @ApiProperty({ description: 'Total number of students who dropped out' })
  dropoutCount: number;

  @ApiProperty({ description: 'Critical dropout points (days/weeks since enrollment)' })
  criticalPoints: {
    timePoint: number; // days since enrollment
    dropoutCount: number;
  }[];
}

// DTO para demografía por edad
export class AgeDistributionDto {
  @ApiProperty({ description: 'Under 18 years old count' })
  under18: number;

  @ApiProperty({ description: '18-25 years old count' })
  age18to25: number;

  @ApiProperty({ description: '26-35 years old count' })
  age26to35: number;

  @ApiProperty({ description: 'Over 36 years old count' })
  over36: number;

  @ApiProperty({ description: 'Unknown age count' })
  unknown: number;
}

// DTO para respuesta completa de estadísticas
export class StatisticsResponseDto {
  @ApiProperty({ description: 'Retention rates by course' })
  retentionRates: RetentionRateDto[];

  @ApiProperty({ description: 'Teacher performance metrics' })
  teacherPerformance: TeacherPerformanceDto[];

  @ApiProperty({ description: 'Revenue data' })
  revenue: RevenueDto;

  @ApiProperty({ description: 'Dropout rates by course' })
  dropoutRates: DropoutRateDto[];

  @ApiProperty({ description: 'Overall dropout rate', minimum: 0, maximum: 100 })
  overallDropoutRate: number;

  @ApiProperty({ description: 'Student age distribution' })
  ageDistribution: AgeDistributionDto;
} 