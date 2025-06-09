import React, { useState, useEffect } from 'react';
import styles from '../../styles/AdminDashboard.module.css';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  statisticsService, 
  OverviewStats, 
  DimensionMetric, 
  MetricType, 
  StatisticsQuery,
  MetricQuery 
} from '../../services/statisticsService';
import apiClient from '../../utils/api-client';

interface StatisticsDashboardProps {
  schoolId?: string;
}

enum DimensionType {
  TEACHER = 'teacher',
  COURSE = 'course', 
  CATEGORY = 'category',
  AGE = 'age'
}

interface DimensionOption {
  id: string;
  name: string;
}

interface ChartDataPoint {
  name: string;
  value: number;
  formattedValue: string;
  present?: number;
  absent?: number;
  id: string;
}

const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({ schoolId }) => {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [selectedDimensionData, setSelectedDimensionData] = useState<{
    attendance: DimensionMetric[];
    revenue: DimensionMetric[];
    retention: DimensionMetric[];
    occupancy: DimensionMetric[];
  }>({
    attendance: [],
    revenue: [],
    retention: [],
    occupancy: []
  });
  
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  
  const [selectedDimension, setSelectedDimension] = useState<DimensionType>(DimensionType.TEACHER);
  const [availableOptions, setAvailableOptions] = useState<DimensionOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDateRangeChange = (field: 'from' | 'to', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const handleDimensionChange = (newDimension: DimensionType) => {
    setSelectedDimension(newDimension);
    setSelectedOptionId(''); // Reset selected option when dimension changes
    setAvailableOptions([]); // Clear options temporarily
  };

  const handleOptionChange = (optionId: string) => {
    setSelectedOptionId(optionId);
  };

  const getDimensionDisplayName = (dimension: DimensionType) => {
    switch (dimension) {
      case DimensionType.TEACHER: return 'Profesor';
      case DimensionType.COURSE: return 'Curso';
      case DimensionType.CATEGORY: return 'Categoría';
      case DimensionType.AGE: return 'Rango de Edad';
    }
  };

  const getMetricDisplayName = (metric: MetricType) => {
    switch (metric) {
      case MetricType.ATTENDANCE: return 'Tasa de Asistencia';
      case MetricType.REVENUE: return 'Ingresos';
      case MetricType.RETENTION: return 'Retención';
      case MetricType.OCCUPANCY: return 'Tasa de Ocupación';
      default: return 'Métrica';
    }
  };

  const fetchAvailableOptions = async (dimension: DimensionType) => {
    try {
      const query: StatisticsQuery = {
        from: dateRange.from,
        to: dateRange.to,
        ...(schoolId && { academyId: schoolId })
      };

      // Use attendance metric to get available options (any metric would work)
      const metricQuery: MetricQuery = { ...query, metric: MetricType.ATTENDANCE };
      
      let options: DimensionOption[] = [];
      
      switch (dimension) {
        case DimensionType.TEACHER:
          const professorData = await statisticsService.getProfessorMetrics(metricQuery);
          options = professorData.map(item => ({ id: item.id, name: item.name }));
          break;
        case DimensionType.COURSE:
          const courseData = await statisticsService.getCourseMetrics(metricQuery);
          options = courseData.map(item => ({ id: item.id, name: item.name }));
          break;
        case DimensionType.CATEGORY:
          const categoryData = await statisticsService.getCategoryMetrics(metricQuery);
          options = categoryData.map(item => ({ id: item.id, name: item.name }));
          break;
        case DimensionType.AGE:
          const ageData = await statisticsService.getAgeRangeMetrics(metricQuery);
          options = ageData.map(item => ({ id: item.id, name: item.name }));
          break;
      }

      setAvailableOptions(options);
    } catch (err) {
      setAvailableOptions([]);
    }
  };

  const fetchDimensionData = async (dimension: DimensionType, specificId?: string) => {
    const query: StatisticsQuery = {
      from: dateRange.from,
      to: dateRange.to,
      ...(schoolId && { academyId: schoolId })
    };

    const metrics = [
      MetricType.ATTENDANCE,
      MetricType.REVENUE, 
      MetricType.RETENTION,
      MetricType.OCCUPANCY
    ];

    const results = await Promise.all(
      metrics.map(async (metric) => {
        const metricQuery: MetricQuery = { ...query, metric };
        
        try {
          let allData: DimensionMetric[] = [];
          
          switch (dimension) {
            case DimensionType.TEACHER:
              allData = await statisticsService.getProfessorMetrics(metricQuery);
              break;
            case DimensionType.COURSE:
              allData = await statisticsService.getCourseMetrics(metricQuery);
              break;
            case DimensionType.CATEGORY:
              allData = await statisticsService.getCategoryMetrics(metricQuery);
              break;
            case DimensionType.AGE:
              allData = await statisticsService.getAgeRangeMetrics(metricQuery);
              break;
            default:
              allData = [];
          }

          // Filter by specific ID if provided
          if (specificId) {
            allData = allData.filter(item => item.id === specificId);
          }

          return { metric, data: allData };
        } catch (err) {
          return { metric, data: [] };
        }
      })
    );

    return {
      attendance: results.find(r => r.metric === MetricType.ATTENDANCE)?.data || [],
      revenue: results.find(r => r.metric === MetricType.REVENUE)?.data || [],
      retention: results.find(r => r.metric === MetricType.RETENTION)?.data || [],
      occupancy: results.find(r => r.metric === MetricType.OCCUPANCY)?.data || []
    };
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const query: StatisticsQuery = {
        from: dateRange.from,
        to: dateRange.to,
        ...(schoolId && { academyId: schoolId })
      };

      // Fetch overview data
      const overviewData = await statisticsService.getOverview(query);
      setOverview(overviewData);

      // Fetch available options for current dimension
      await fetchAvailableOptions(selectedDimension);

      // Fetch dimension-specific data
      const dimensionData = await fetchDimensionData(selectedDimension, selectedOptionId || undefined);
      setSelectedDimensionData(dimensionData);

    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [dateRange, selectedDimension, selectedOptionId, schoolId]);

  const formatMetricValue = (metric: MetricType, value: number) => {
    return statisticsService.formatMetricValue(metric, value);
  };

  const prepareChartData = (data: DimensionMetric[], metric: MetricType): ChartDataPoint[] => {
    return data.slice(0, 10).map(item => ({
      name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
      value: item.value,
      formattedValue: formatMetricValue(metric, item.value),
      present: item.context?.present,
      absent: item.context?.absent,
      id: item.id
    }));
  };

  const getMetricColor = (metric: MetricType): string => {
    switch (metric) {
      case MetricType.ATTENDANCE: return '#3b82f6'; // Blue
      case MetricType.REVENUE: return '#10b981';     // Green
      case MetricType.RETENTION: return '#f59e0b';   // Orange
      case MetricType.OCCUPANCY: return '#8b5cf6';   // Purple
      default: return '#6b7280';                     // Gray
    }
  };

  const CustomTooltip = ({ active, payload, label, metric }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#111827' }}>
            {label}
          </p>
          <p style={{ margin: '0 0 4px 0', color: getMetricColor(metric) }}>
            {`${getMetricDisplayName(metric)}: ${data.formattedValue}`}
          </p>
          {data.present !== undefined && data.absent !== undefined && (
            <p style={{ margin: '0', fontSize: '12px', color: '#6b7280' }}>
              {data.present} presentes, {data.absent} ausentes
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const renderMetricChart = (title: string, metric: MetricType, data: DimensionMetric[]) => {
    const chartData = prepareChartData(data, metric);
    const color = getMetricColor(metric);
    
    const chartTitle = selectedOptionId && availableOptions.length > 0 
      ? `${title} - ${availableOptions.find(opt => opt.id === selectedOptionId)?.name || 'Seleccionado'}`
      : `${title} por ${getDimensionDisplayName(selectedDimension)}`;
    
    return (
      <div className={styles.infoCard} style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#1f2937', fontSize: '1.25rem' }}>
          {chartTitle}
        </h2>
        
        {chartData.length > 0 ? (
          <div style={{ width: '100%', height: '400px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                  fontSize={12}
                  stroke="#6b7280"
                />
                <YAxis 
                  fontSize={12}
                  stroke="#6b7280"
                  tickFormatter={(value) => formatMetricValue(metric, value)}
                />
                <Tooltip 
                  content={(props) => <CustomTooltip {...props} metric={metric} />}
                />
                <Bar 
                  dataKey="value" 
                  fill={color}
                  radius={[4, 4, 0, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            color: '#6b7280',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            <p>No hay datos de {title.toLowerCase()} disponibles para {getDimensionDisplayName(selectedDimension).toLowerCase()}</p>
          </div>
        )}
      </div>
    );
  };

  if (loading && !overview) {
    return (
      <div className={styles.loading}>
        <p>Cargando analíticas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorMessage}>
        <p>Error: {error}</p>
        <button onClick={refreshData} className={styles.retryButton}>
          Intentar de Nuevo
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className={styles.dashboardHeader}>
        <h1>Panel de Analíticas</h1>
        <p>Selecciona una dimensión y rango de fechas para analizar métricas de rendimiento</p>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
          alignItems: 'end'
        }}>
          {/* Date Range */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
              Fecha Desde
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateRangeChange('from', e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '0.5rem',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
              Fecha Hasta
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateRangeChange('to', e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '0.5rem',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Dimension Selector */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
              Analizar Por
            </label>
            <select
              value={selectedDimension}
              onChange={(e) => handleDimensionChange(e.target.value as DimensionType)}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                padding: '0.5rem',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value={DimensionType.TEACHER}>Profesor</option>
              <option value={DimensionType.COURSE}>Curso</option>
              <option value={DimensionType.CATEGORY}>Categoría</option>
              <option value={DimensionType.AGE}>Rango de Edad</option>
            </select>
          </div>

          {/* Specific Option Selector - Only show if there are available options */}
          {availableOptions.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '14px', fontWeight: '500' }}>
                {getDimensionDisplayName(selectedDimension)} Específico
              </label>
              <select
                value={selectedOptionId}
                onChange={(e) => handleOptionChange(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '0.5rem',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">Todos los {getDimensionDisplayName(selectedDimension).toLowerCase()}s</option>
                {availableOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <div>
            <button 
              onClick={refreshData} 
              disabled={loading} 
              className={styles.refreshButton}
              style={{ width: '100%' }}
            >
              {loading ? 'Cargando...' : 'Actualizar Datos'}
            </button>
          </div>
        </div>
      </div>

      {/* Overview Summary */}
      {overview && !selectedOptionId && (
        <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
          <div className={styles.statCard}>
            <h3>Ingresos Totales</h3>
            <div className={styles.statValue} style={{ color: '#10b981' }}>
              {statisticsService.formatCurrency(overview.totalRevenueCents)}
            </div>
            <p>Últimos {Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24))} días</p>
          </div>

          <div className={styles.statCard}>
            <h3>Asistencia General</h3>
            <div className={styles.statValue} style={{ color: '#3b82f6' }}>
              {statisticsService.formatPercentage(overview.attendanceRate)}
            </div>
            <p>{overview.totalPresent} presentes, {overview.totalAbsent} ausentes</p>
          </div>

          <div className={styles.statCard}>
            <h3>Tasa de Ocupación</h3>
            <div className={styles.statValue} style={{ color: '#8b5cf6' }}>
              {statisticsService.formatPercentage(overview.occupancyRate)}
            </div>
            <p>Utilización de capacidad</p>
          </div>

          <div className={styles.statCard}>
            <h3>Retención Promedio</h3>
            <div className={styles.statValue} style={{ color: '#f59e0b' }}>
              {statisticsService.formatDays(overview.avgRetentionDays)}
            </div>
            <p>{overview.totalActive} estudiantes activos</p>
          </div>
        </div>
      )}

      {/* Metric Charts */}
      <div style={{ marginTop: '2rem' }}>
        {renderMetricChart(getMetricDisplayName(MetricType.ATTENDANCE), MetricType.ATTENDANCE, selectedDimensionData.attendance)}
        {renderMetricChart(getMetricDisplayName(MetricType.REVENUE), MetricType.REVENUE, selectedDimensionData.revenue)}
        {renderMetricChart(getMetricDisplayName(MetricType.RETENTION), MetricType.RETENTION, selectedDimensionData.retention)}
        {renderMetricChart(getMetricDisplayName(MetricType.OCCUPANCY), MetricType.OCCUPANCY, selectedDimensionData.occupancy)}
      </div>
    </div>
  );
};

export default StatisticsDashboard; 