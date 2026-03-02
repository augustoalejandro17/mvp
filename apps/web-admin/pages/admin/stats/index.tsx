import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { LineChart, BarChart, DoughnutChart } from '../../../components/stats/ChartComponents';
import { StatCard, StatCardGrid } from '../../../components/stats/StatCards';
import DataTable, { ColumnRenderers } from '../../../components/stats/DataTable';
import styles from '../../../styles/Stats.module.css';

// Tipos para las respuestas de la API
interface StatisticsData {
  retentionRates: {
    courseId: string;
    courseName: string;
    initialEnrollment: number;
    currentEnrollment: number;
    retentionRate: number;
    completedCount: number;
    completionRate: number;
  }[];
  teacherPerformance: {
    teacherId: string;
    teacherName: string;
    avgRetentionRate: number;
    avgAttendanceRate: number;
    coursesCount: number;
    studentsCount: number;
  }[];
  revenue: {
    byDate: { date: string; amount: number }[];
    totalRevenue: number;
    avgDailyRevenue: number;
    nextMonthProjection: number;
  };
  dropoutRates: {
    courseId: string;
    courseName: string;
    dropoutRate: number;
    dropoutCount: number;
    criticalPoints: { timePoint: number; dropoutCount: number }[];
  }[];
  overallDropoutRate: number;
  ageDistribution: {
    under18: number;
    age18to25: number;
    age26to35: number;
    over36: number;
    unknown: number;
  };
}

export default function StatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Verificar autentificación al cargar la página
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login?redirect=/admin/stats');
      return;
    }

    fetchStats();
  }, []);

  // Cargar estádisticas desde la API
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      const response = await fetch(`/api/admin-stats?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error: any) {
      console.error('Error al cargar estádisticas:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en el rango de fechas
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  // Aplicar filtros
  const handleFilterApply = () => {
    fetchStats();
  };

  // Si está cargando mostrar mensaje
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando estádisticas...</div>;
  }

  // Si hay error mostrar mensaje
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={fetchStats}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Preparar datos para los gráficos
  const prepareRevenueChartData = () => {
    if (!stats?.revenue.byDate) return { labels: [], datasets: [] };
    
    return {
      labels: stats.revenue.byDate.map(item => ColumnRenderers.date(item.date)),
      datasets: [
        {
          label: 'Ingresos',
          data: stats.revenue.byDate.map(item => item.amount),
          borderColor: 'rgba(49, 130, 206, 0.7)',
        }
      ]
    };
  };

  const prepareRetentionChartData = () => {
    if (!stats?.retentionRates) return { labels: [], datasets: [] };
    
    return {
      labels: stats.retentionRates.map(course => course.courseName),
      datasets: [
        {
          label: 'Retención',
          data: stats.retentionRates.map(course => course.retentionRate),
          backgroundColor: 'rgba(49, 130, 206, 0.7)',
        }
      ]
    };
  };

  const prepareAgeDistributionData = () => {
    if (!stats?.ageDistribution) return { labels: [], datasets: [] };
    
    return {
      labels: ['<18', '18-25', '26-35', '36+', 'Desconocido'],
      datasets: [
        {
          data: [
            stats.ageDistribution.under18,
            stats.ageDistribution.age18to25,
            stats.ageDistribution.age26to35,
            stats.ageDistribution.over36,
            stats.ageDistribution.unknown
          ],
          backgroundColor: [
            'rgba(66, 153, 225, 0.7)',
            'rgba(49, 130, 206, 0.7)',
            'rgba(43, 108, 176, 0.7)',
            'rgba(44, 82, 130, 0.7)',
            'rgba(113, 128, 150, 0.7)'
          ],
        }
      ]
    };
  };

  // Columnas para tablas de datos
  const retentionColumns = [
    { header: 'Curso', accessor: 'courseName' },
    { header: 'Inscriptos', accessor: 'initialEnrollment', width: '100px' },
    { header: 'Activos', accessor: 'currentEnrollment', width: '80px' },
    { 
      header: 'Retención', 
      accessor: 'retentionRate', 
      width: '100px',
      render: (value: number) => ColumnRenderers.rate(value, 'retention')
    },
    { 
      header: 'Completos', 
      accessor: 'completionRate', 
      width: '100px',
      render: (value: number) => ColumnRenderers.rate(value, 'retention')
    },
  ];

  const teacherColumns = [
    { header: 'Profesor', accessor: 'teacherName' },
    { header: 'Cursos', accessor: 'coursesCount', width: '80px' },
    { header: 'Estudiantes', accessor: 'studentsCount', width: '100px' },
    { 
      header: 'Retención', 
      accessor: 'avgRetentionRate', 
      width: '100px',
      render: (value: number) => ColumnRenderers.rate(value, 'retention')
    },
    { 
      header: 'Asistencia', 
      accessor: 'avgAttendanceRate', 
      width: '100px',
      render: (value: number) => ColumnRenderers.rate(value, 'attendance')
    },
  ];

  const dropoutColumns = [
    { header: 'Curso', accessor: 'courseName' },
    { header: 'Abandonos', accessor: 'dropoutCount', width: '100px' },
    { 
      header: 'Tasa', 
      accessor: 'dropoutRate', 
      width: '80px',
      render: (value: number) => ColumnRenderers.rate(value, 'dropout')
    },
    { 
      header: 'Punto crítico', 
      accessor: 'criticalPoints',
      width: '120px', 
      render: (criticalPoints: any[]) => {
        if (!criticalPoints || !criticalPoints.length) return '-';
        const maxPoint = criticalPoints.reduce((max, point) => 
          point.dropoutCount > max.dropoutCount ? point : max, criticalPoints[0]);
        return `Día ${maxPoint.timePoint}`;
      }
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Estadísticas de Academia</h1>
        <p>Visualiza métricas clave y análisis de rendimiento para tu academia.</p>
      </div>

      <div className={styles.content}>
        {/* Menu de navegación lateral */}
        <div className={styles.sidebar}>
          <nav className={styles.nav}>
            <Link href="/" className={styles.navLink}>
              Inicio
            </Link>
            <Link href="/admin/dashboard" className={styles.navLink}>
              Dashboard
            </Link>
            <Link href="/admin/stats" className={`${styles.navLink} ${styles.active}`}>
              Estádisticas
            </Link>
            <Link href="/admin/stats/retention" className={styles.navLink}>
              Retención
            </Link>
            <Link href="/admin/stats/performance" className={styles.navLink}>
              Profesores
            </Link>
            <Link href="/admin/stats/revenue" className={styles.navLink}>
              Ingresos
            </Link>
            <Link href="/admin/stats/dropout" className={styles.navLink}>
              Abandonos
            </Link>
            <Link href="/admin/stats/demographics" className={styles.navLink}>
              Demografía
            </Link>
          </nav>
        </div>

        {/* Contenido principal */}
        <div className={styles.mainContent}>
          {/* Filtros y controles */}
          <div className={styles.controlsRow}>
            <div className={styles.dateControl}>
              <label htmlFor="startDate">Fecha inicio</label>
              <input 
                type="date" 
                id="startDate"
                name="startDate"
                value={dateRange.startDate}
                onChange={handleDateChange}
              />
            </div>
            <div className={styles.dateControl}>
              <label htmlFor="endDate">Fecha fin</label>
              <input 
                type="date" 
                id="endDate"
                name="endDate"
                value={dateRange.endDate}
                onChange={handleDateChange}
              />
            </div>
            <button 
              className={styles.filterButton}
              onClick={handleFilterApply}
            >
              Aplicar
            </button>
          </div>

          {/* Tarjetas de estádisticas principales */}
          <StatCardGrid>
            <StatCard 
              title="Retención Total" 
              value={stats?.overallDropoutRate ? 100 - stats.overallDropoutRate : 0}
              format="percentage"
              subtext="Promedio de todos los cursos"
            />
            <StatCard 
              title="Ingresos Totales" 
              value={stats?.revenue?.totalRevenue || 0}
              format="currency"
              subtext={`En el período seleccionado`}
            />
            <StatCard 
              title="Proyección Mensual" 
              value={stats?.revenue?.nextMonthProjection || 0}
              format="currency"
              subtext="Próximo mes"
              trend={{
                direction: (stats?.revenue?.nextMonthProjection || 0) > (stats?.revenue?.totalRevenue || 0) ? 'up' : 'down',
                value: 10 // Simulado
              }}
            />
            <StatCard 
              title="Abandono" 
              value={stats?.overallDropoutRate || 0}
              format="percentage"
              subtext="Tasa global de abandonos"
            />
          </StatCardGrid>

          {/* Gráfico de ingresos */}
          <div className={styles.section}>
            <h2>Ingresos en el Período</h2>
            <LineChart 
              title="Evolución de Ingresos"
              data={prepareRevenueChartData()}
            />
          </div>

          {/* Columnas con gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div>
              <h2 className={styles.section}>Retención por Curso</h2>
              <BarChart 
                title="Top 5 Cursos por Retención"
                data={prepareRetentionChartData()}
                horizontal={true}
              />
            </div>
            <div>
              <h2 className={styles.section}>Distribución por Edad</h2>
              <DoughnutChart 
                title="Estudiantes por Grupo de Edad"
                data={prepareAgeDistributionData()}
              />
            </div>
          </div>

          {/* Tablas de datos */}
          <div className={styles.section}>
            <h2>Retención de Estudiantes</h2>
            <DataTable 
              columns={retentionColumns}
              data={stats?.retentionRates || []}
              emptyMessage="No hay datos de retención disponibles"
            />
          </div>

          <div className={styles.section}>
            <h2>Rendimiento de Profesores</h2>
            <DataTable 
              columns={teacherColumns}
              data={stats?.teacherPerformance || []}
              emptyMessage="No hay datos de profesores disponibles"
            />
          </div>

          <div className={styles.section}>
            <h2>Tasas de Abandono</h2>
            <DataTable 
              columns={dropoutColumns}
              data={stats?.dropoutRates || []}
              emptyMessage="No hay datos de abandono disponibles"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 