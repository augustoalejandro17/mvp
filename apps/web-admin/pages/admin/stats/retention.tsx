import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { LineChart, BarChart } from '../../../components/stats/ChartComponents';
import { StatCard, StatCardGrid } from '../../../components/stats/StatCards';
import DataTable, { ColumnRenderers } from '../../../components/stats/DataTable';
import styles from '../../../styles/Stats.module.css';

// Tipos para las respuestas de la API
interface RetentionData {
  retentionRates: {
    courseId: string;
    courseName: string;
    initialEnrollment: number;
    currentEnrollment: number;
    retentionRate: number;
    completedCount: number;
    completionRate: number;
    monthlyTrend?: { month: string; rate: number }[];
  }[];
  overallRetentionRate: number;
  completionRateAvg: number;
  retentionTrend: { period: string; rate: number }[];
}

export default function RetentionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retentionData, setRetentionData] = useState<RetentionData | null>(null);

  // Verificar autentificación al cargar la página
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login?redirect=/admin/stats/retention');
      return;
    }

    fetchRetentionData();
  }, []);

  // Cargar datos de retención desde la API
  const fetchRetentionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = Cookies.get('token');
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/admin-stats/retention`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setRetentionData(data);
    } catch (error: any) {
      console.error('Error al cargar datos de retención:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Si está cargando mostrar mensaje
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando datos de retención...</div>;
  }

  // Si hay error mostrar mensaje
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={fetchRetentionData}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Preparar datos para los gráficos
  const prepareRetentionTrendData = () => {
    if (!retentionData?.retentionTrend) return { labels: [], datasets: [] };
    
    return {
      labels: retentionData.retentionTrend.map(item => item.period),
      datasets: [
        {
          label: 'Tasa de retención',
          data: retentionData.retentionTrend.map(item => item.rate),
          borderColor: 'rgba(49, 130, 206, 0.7)',
        }
      ]
    };
  };

  const prepareCoursesData = () => {
    if (!retentionData?.retentionRates) return { labels: [], datasets: [] };
    
    // Ordenar cursos por tasa de retención
    const sortedCourses = [...retentionData.retentionRates].sort((a, b) => b.retentionRate - a.retentionRate);
    
    return {
      labels: sortedCourses.map(course => course.courseName),
      datasets: [
        {
          label: 'Retención',
          data: sortedCourses.map(course => course.retentionRate),
          backgroundColor: 'rgba(49, 130, 206, 0.7)',
        },
        {
          label: 'Finalización',
          data: sortedCourses.map(course => course.completionRate),
          backgroundColor: 'rgba(72, 187, 120, 0.7)',
        }
      ]
    };
  };

  // Definir columnas para la tabla
  const retentionColumns = [
    { header: 'Curso', accessor: 'courseName' },
    { header: 'Inscriptos', accessor: 'initialEnrollment', width: '90px' },
    { header: 'Activos', accessor: 'currentEnrollment', width: '80px' },
    { 
      header: 'Retención', 
      accessor: 'retentionRate', 
      width: '90px',
      render: (value: number) => ColumnRenderers.rate(value, 'retention')
    },
    { 
      header: 'Completados', 
      accessor: 'completedCount', 
      width: '100px' 
    },
    { 
      header: 'Tasa de completado', 
      accessor: 'completionRate', 
      width: '120px',
      render: (value: number) => ColumnRenderers.rate(value, 'retention')
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Análisis de Retención</h1>
        <p>Estadísticas detalladas sobre retención de estudiantes por curso</p>
      </div>

      <div className={styles.content}>
        {/* Menu de navegación lateral */}
        <div className={styles.sidebar}>
          <nav className={styles.nav}>
            <Link href="/admin/dashboard" className={styles.navLink}>
              Dashboard
            </Link>
            <Link href="/admin/stats" className={styles.navLink}>
              Resumen
            </Link>
            <Link href="/admin/stats/retention" className={`${styles.navLink} ${styles.active}`}>
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
          {/* Tarjetas de métricas principales */}
          <StatCardGrid>
            <StatCard 
              title="Retención Promedio" 
              value={retentionData?.overallRetentionRate || 0}
              format="percentage"
              subtext="Todos los cursos"
            />
            <StatCard 
              title="Tasa de Finalización" 
              value={retentionData?.completionRateAvg || 0}
              format="percentage"
              subtext="Promedio de todos los cursos"
            />
            <StatCard 
              title="Estudiantes Activos" 
              value={retentionData?.retentionRates.reduce((sum, course) => sum + course.currentEnrollment, 0) || 0}
              format="number"
              subtext="Total de estudiantes actuales"
            />
            <StatCard 
              title="Cursos Completados" 
              value={retentionData?.retentionRates.reduce((sum, course) => sum + course.completedCount, 0) || 0}
              format="number"
              subtext="Estudiantes que finalizaron"
            />
          </StatCardGrid>

          {/* Gráficos de retención */}
          <div className={styles.section}>
            <h2>Evolución de Retención</h2>
            <LineChart 
              title="Tendencia de Retención"
              data={prepareRetentionTrendData()}
            />
          </div>

          <div className={styles.section}>
            <h2>Comparativa por Curso</h2>
            <BarChart 
              title="Retención y Finalización por Curso"
              data={prepareCoursesData()}
              horizontal={true}
            />
          </div>

          {/* Tabla detallada */}
          <div className={styles.section}>
            <h2>Detalle por Curso</h2>
            <DataTable 
              columns={retentionColumns}
              data={retentionData?.retentionRates || []}
              emptyMessage="No hay datos de retención disponibles"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 