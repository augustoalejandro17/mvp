import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { LineChart, BarChart, DoughnutChart } from '../../../components/stats/ChartComponents';
import { StatCard, StatCardGrid } from '../../../components/stats/StatCards';
import DataTable, { ColumnRenderers } from '../../../components/stats/DataTable';
import styles from '../../../styles/Stats.module.css';

// Tipos para las respuestas de la API
interface RevenueData {
  byDate: { date: string; amount: number }[];
  totalRevenue: number;
  avgDailyRevenue: number;
  avgMonthlyRevenue: number;
  nextMonthProjection: number;
  revenueByCourse: {
    courseId: string;
    courseName: string;
    revenue: number;
    studentsCount: number;
    averageRevenuePerStudent: number;
  }[];
  monthlyRevenue: {
    month: string;
    revenue: number;
    projection?: number;
  }[];
  projectionAccuracy: number;
}

export default function RevenuePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Verificar autentificaciu00f3n al cargar la pu00e1gina
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login?redirect=/admin/stats/revenue');
      return;
    }

    fetchRevenueData();
  }, []);

  // Cargar datos de ingresos desde la API
  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      const response = await fetch(`/api/admin-stats/revenue?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setRevenueData(data);
    } catch (error: any) {
      console.error('Error al cargar datos de ingresos:', error);
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
    fetchRevenueData();
  };

  // Si estu00e1 cargando mostrar mensaje
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando datos de ingresos...</div>;
  }

  // Si hay error mostrar mensaje
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={fetchRevenueData}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Preparar datos para los gru00e1ficos
  const prepareDailyRevenueData = () => {
    if (!revenueData?.byDate) return { labels: [], datasets: [] };
    
    return {
      labels: revenueData.byDate.map(item => ColumnRenderers.date(item.date)),
      datasets: [
        {
          label: 'Ingresos diarios',
          data: revenueData.byDate.map(item => item.amount),
          borderColor: 'rgba(49, 130, 206, 0.7)',
        }
      ]
    };
  };

  const prepareMonthlyRevenueData = () => {
    if (!revenueData?.monthlyRevenue) return { labels: [], datasets: [] };
    
    // Convert null values to 0 to fix type issues
    return {
      labels: revenueData.monthlyRevenue.map(item => item.month),
      datasets: [
        {
          label: 'Ingresos mensuales',
          data: revenueData.monthlyRevenue.map(item => item.revenue),
          backgroundColor: 'rgba(49, 130, 206, 0.7)',
          borderColor: 'rgba(49, 130, 206, 0.7)',
        },
        {
          label: 'Proyecciones',
          data: revenueData.monthlyRevenue.map(item => item.projection || 0), // Use 0 instead of null
          borderColor: 'rgba(237, 137, 54, 0.7)',
          backgroundColor: 'rgba(0, 0, 0, 0)', // Transparent
          borderDash: [5, 5],
        }
      ]
    };
  };

  const prepareCourseRevenueData = () => {
    if (!revenueData?.revenueByCourse) return { labels: [], datasets: [] };
    
    // Ordenar cursos por ingresos
    const sortedCourses = [...revenueData.revenueByCourse]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8); // Top 8
    
    return {
      labels: sortedCourses.map(course => course.courseName),
      datasets: [
        {
          data: sortedCourses.map(course => course.revenue),
          backgroundColor: [
            'rgba(66, 153, 225, 0.7)',
            'rgba(49, 130, 206, 0.7)',
            'rgba(43, 108, 176, 0.7)',
            'rgba(44, 82, 130, 0.7)',
            'rgba(72, 187, 120, 0.7)',
            'rgba(56, 178, 172, 0.7)',
            'rgba(237, 137, 54, 0.7)',
            'rgba(113, 128, 150, 0.7)'
          ],
        }
      ]
    };
  };

  // Columnas para la tabla de ingresos por curso
  const revenueColumns = [
    { header: 'Curso', accessor: 'courseName' },
    { 
      header: 'Ingresos', 
      accessor: 'revenue',
      width: '120px',
      render: (value: number) => ColumnRenderers.currency(value)
    },
    { header: 'Estudiantes', accessor: 'studentsCount', width: '100px' },
    { 
      header: 'Ingreso/Estudiante', 
      accessor: 'averageRevenuePerStudent',
      width: '150px',
      render: (value: number) => ColumnRenderers.currency(value)
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Anu00e1lisis de Ingresos</h1>
        <p>Mu00e9tricas financieras y proyecciones para la academia</p>
      </div>

      <div className={styles.content}>
        {/* Menu de navegaciu00f3n lateral */}
        <div className={styles.sidebar}>
          <nav className={styles.nav}>
            <Link href="/admin/dashboard" className={styles.navLink}>
              Dashboard
            </Link>
            <Link href="/admin/stats" className={styles.navLink}>
              Resumen
            </Link>
            <Link href="/admin/stats/retention" className={styles.navLink}>
              Retenciu00f3n
            </Link>
            <Link href="/admin/stats/performance" className={styles.navLink}>
              Profesores
            </Link>
            <Link href="/admin/stats/revenue" className={`${styles.navLink} ${styles.active}`}>
              Ingresos
            </Link>
            <Link href="/admin/stats/dropout" className={styles.navLink}>
              Abandonos
            </Link>
            <Link href="/admin/stats/demographics" className={styles.navLink}>
              Demografu00eda
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

          {/* Tarjetas de mu00e9tricas principales */}
          <StatCardGrid>
            <StatCard 
              title="Ingresos Totales" 
              value={revenueData?.totalRevenue || 0}
              format="currency"
              subtext={`Peru00edodo seleccionado`}
            />
            <StatCard 
              title="Promedio Diario" 
              value={revenueData?.avgDailyRevenue || 0}
              format="currency"
              subtext="Por du00eda operativo"
            />
            <StatCard 
              title="Promedio Mensual" 
              value={revenueData?.avgMonthlyRevenue || 0}
              format="currency"
              subtext="u00daltimos 6 meses"
            />
            <StatCard 
              title="Proyecciu00f3n Pru00f3ximo Mes" 
              value={revenueData?.nextMonthProjection || 0}
              format="currency"
              subtext={`Exactitud: ${revenueData?.projectionAccuracy || 0}%`}
            />
          </StatCardGrid>

          {/* Gru00e1ficos de ingresos */}
          <div className={styles.section}>
            <h2>Ingresos Diarios</h2>
            <LineChart 
              title="Detalle de Ingresos"
              data={prepareDailyRevenueData()}
            />
          </div>

          <div className={styles.section}>
            <h2>Evoluciu00f3n Mensual</h2>
            <BarChart 
              title="Ingresos y Proyecciones"
              data={prepareMonthlyRevenueData()}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className={styles.section}>
              <h2>Distribuciu00f3n por Curso</h2>
              <DoughnutChart 
                title="Ingresos por Curso"
                data={prepareCourseRevenueData()}
              />
            </div>
          </div>

          {/* Tabla detallada */}
          <div className={styles.section}>
            <h2>Ingresos por Curso</h2>
            <DataTable 
              columns={revenueColumns}
              data={revenueData?.revenueByCourse || []}
              emptyMessage="No hay datos de ingresos disponibles"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 