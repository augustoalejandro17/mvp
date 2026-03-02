import apiClient from '../utils/api-client';

export interface OverviewStats {
  dateRange: { from: string; to: string };
  totalRevenueCents: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
  occupancyRate: number;
  noShowRate: number;
  avgRetentionDays: number;
  totalActive: number;
  totalDropped: number;
  churnRate: number;
}

export interface DimensionMetric {
  id: string;
  name: string;
  value: number;
  context: {
    present?: number;
    absent?: number;
    maxSeats?: number;
    revenueCents?: number;
    active?: number;
    dropped?: number;
  };
}

export interface TimeSeriesData {
  metric: string;
  dateRange: { from: string; to: string };
  data: Array<{
    date: string;
    value: number;
    context: {
      present?: number;
      absent?: number;
      maxSeats?: number;
      revenueCents?: number;
      active?: number;
      dropped?: number;
    };
  }>;
}

export enum MetricType {
  ATTENDANCE = 'attendance',
  OCCUPANCY = 'occupancy',
  REVENUE = 'revenue',
  NO_SHOW = 'no-show',
  RETENTION = 'retention'
}

export interface StatisticsQuery {
  from?: string;
  to?: string;
  academyId?: string;
}

export interface MetricQuery extends StatisticsQuery {
  metric: MetricType;
}

export interface CourseMetricQuery extends MetricQuery {
  courseId?: string;
}

class StatisticsService {
  private baseUrl = '/api/statistics';

  async getOverview(query: StatisticsQuery): Promise<OverviewStats> {
    const params = new URLSearchParams();
    if (query.from) params.append('from', query.from);
    if (query.to) params.append('to', query.to);
    if (query.academyId) params.append('academyId', query.academyId);

    const response = await apiClient.get(`${this.baseUrl}/overview?${params}`);
    return response.data;
  }

  async getProfessorMetrics(query: MetricQuery): Promise<DimensionMetric[]> {
    const params = new URLSearchParams();
    params.append('metric', query.metric);
    if (query.from) params.append('from', query.from);
    if (query.to) params.append('to', query.to);
    if (query.academyId) params.append('academyId', query.academyId);

    const response = await apiClient.get(`${this.baseUrl}/professors?${params}`);
    return response.data;
  }

  async getCourseMetrics(query: MetricQuery): Promise<DimensionMetric[]> {
    const params = new URLSearchParams();
    params.append('metric', query.metric);
    if (query.from) params.append('from', query.from);
    if (query.to) params.append('to', query.to);
    if (query.academyId) params.append('academyId', query.academyId);

    const response = await apiClient.get(`${this.baseUrl}/courses?${params}`);
    return response.data;
  }

  async getCourseTimeSeries(query: CourseMetricQuery): Promise<TimeSeriesData> {
    const params = new URLSearchParams();
    params.append('metric', query.metric);
    if (query.courseId) params.append('courseId', query.courseId);
    if (query.from) params.append('from', query.from);
    if (query.to) params.append('to', query.to);
    if (query.academyId) params.append('academyId', query.academyId);

    const response = await apiClient.get(`${this.baseUrl}/courses/timeseries?${params}`);
    return response.data;
  }

  async getCategoryMetrics(query: MetricQuery): Promise<DimensionMetric[]> {
    const params = new URLSearchParams();
    params.append('metric', query.metric);
    if (query.from) params.append('from', query.from);
    if (query.to) params.append('to', query.to);
    if (query.academyId) params.append('academyId', query.academyId);

    const response = await apiClient.get(`${this.baseUrl}/categories?${params}`);
    return response.data;
  }

  async getAgeRangeMetrics(query: MetricQuery): Promise<DimensionMetric[]> {
    const params = new URLSearchParams();
    params.append('metric', query.metric);
    if (query.from) params.append('from', query.from);
    if (query.to) params.append('to', query.to);
    if (query.academyId) params.append('academyId', query.academyId);

    const response = await apiClient.get(`${this.baseUrl}/age-ranges?${params}`);
    return response.data;
  }

  // Helper functions
  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  }

  formatPercentage(decimal: number): string {
    return `${(decimal * 100).toFixed(1)}%`;
  }

  formatDays(days: number): string {
    if (days < 30) return `${days} días`;
    if (days < 365) return `${Math.round(days / 30)} meses`;
    return `${Math.round(days / 365)} años`;
  }

  getMetricName(metric: MetricType): string {
    switch (metric) {
      case MetricType.ATTENDANCE: return 'Tasa de Asistencia';
      case MetricType.OCCUPANCY: return 'Tasa de Ocupación';
      case MetricType.REVENUE: return 'Ingresos';
      case MetricType.NO_SHOW: return 'Tasa de Inasistencia';
      case MetricType.RETENTION: return 'Retención';
      default: return metric;
    }
  }

  formatMetricValue(metric: MetricType, value: number): string {
    switch (metric) {
      case MetricType.ATTENDANCE:
      case MetricType.OCCUPANCY:
      case MetricType.NO_SHOW:
        return this.formatPercentage(value);
      case MetricType.REVENUE:
        return this.formatCurrency(value);
      case MetricType.RETENTION:
        return this.formatDays(value);
      default:
        return value.toString();
    }
  }
}

export const statisticsService = new StatisticsService(); 