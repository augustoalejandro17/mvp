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