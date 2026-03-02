import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { LineChart, BarChart } from '../../../components/stats/ChartComponents';
import { StatCard, StatCardGrid } from '../../../components/stats/StatCards';
import DataTable, { ColumnRenderers } from '../../../components/stats/DataTable';
import styles from '../../../styles/Stats.module.css';

// Tipos para las respuestas de la API
interface DropoutData {
  dropoutRates: {
    courseId: string;
    courseName: string;
    dropoutRate: number;
    dropoutCount: number;
    enrollmentCount: number;
    criticalPoints: { timePoint: number; dropoutCount: number }[];
  }[];
  overallDropoutRate: number;
  dropoutReasons: {
    reason: string;
    count: number;
    percentage: number;
  }[];
  dropoutTrend: {
    period: string;
    rate: number;
  }[];
  courseComparisonData: {
    course: string;
    initialRate: number;
    currentRate: number;
  }[];
}

export default function DropoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dropoutData, setDropoutData] = useState<DropoutData | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // Verificar autentificaciu00f3n al cargar la pu00e1gina
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login?redirect=/admin/stats/dropout');
      return;
    }

    fetchDropoutData();
  }, []);

  // Cargar datos de abandono desde la API
  const fetchDropoutData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/admin-stats/dropout`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDropoutData(data);
    } catch (error: any) {
      console.error('Error al cargar datos de abandono:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Si estu00e1 cargando mostrar mensaje
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando datos de abandono...</div>;
  }

  // Si hay error mostrar mensaje
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={fetchDropoutData}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Preparar datos para los gru00e1ficos
  const prepareDropoutTrendData = () => {
    if (!dropoutData?.dropoutTrend) return { labels: [], datasets: [] };
    
    return {
      labels: dropoutData.dropoutTrend.map(item => item.period),
      datasets: [
        {
          label: 'Tasa de abandono',
          data: dropoutData.dropoutTrend.map(item => item.rate),
          borderColor: 'rgba(229, 62, 62, 0.7)',
        }
      ]
    };
  };

  const prepareCourseComparisonData = () => {
    if (!dropoutData?.courseComparisonData) return { labels: [], datasets: [] };
    
    return {
      labels: dropoutData.courseComparisonData.map(item => item.course),
      datasets: [
        {
          label: 'Tasa inicial',
          data: dropoutData.courseComparisonData.map(item => item.initialRate),
          backgroundColor: 'rgba(66, 153, 225, 0.7)',
        },
        {
          label: 'Tasa actual',
          data: dropoutData.courseComparisonData.map(item => item.currentRate),
          backgroundColor: 'rgba(229, 62, 62, 0.7)',
        }
      ]
    };
  };

  const prepareDropoutReasonsData = () => {
    if (!dropoutData?.dropoutReasons) return { labels: [], datasets: [] };
    
    const topReasons = [...dropoutData.dropoutReasons]
      .sort((a, b) => b.count - a.count);
    
    return {
      labels: topReasons.map(item => item.reason),
      datasets: [
        {
          label: 'Motivos de abandono',
          data: topReasons.map(item => item.count),
          backgroundColor: [
            'rgba(229, 62, 62, 0.7)',
            'rgba(237, 137, 54, 0.7)',
            'rgba(66, 153, 225, 0.7)',
            'rgba(113, 128, 150, 0.7)',
            'rgba(72, 187, 120, 0.7)',
          ],
        }
      ]
    };
  };

  const prepareCriticalPointsData = () => {
    if (!selectedCourse || !dropoutData?.dropoutRates) return { labels: [], datasets: [] };
    
    const courseData = dropoutData.dropoutRates.find(c => c.courseId === selectedCourse);
    if (!courseData?.criticalPoints) return { labels: [], datasets: [] };
    
    return {
      labels: courseData.criticalPoints.map(item => `Du00eda ${item.timePoint}`),
      datasets: [
        {
          label: 'Abandonos',
          data: courseData.criticalPoints.map(item => item.dropoutCount),
          backgroundColor: 'rgba(229, 62, 62, 0.7)',
        }
      ]
    };
  };

  // Definir columnas para la tabla de abandono
  const dropoutColumns = [
    { 
      header: 'Curso', 
      accessor: 'courseName',
      render: (value: string, row: any) => (
        <button 
          onClick={() => setSelectedCourse(row.courseId)}
          className="text-blue-500 hover:underline"
        >
          {value}
        </button>
      )
    },
    { header: 'Estudiantes', accessor: 'enrollmentCount', width: '100px' },
    { header: 'Abandonos', accessor: 'dropoutCount', width: '90px' },
    { 
      header: 'Tasa', 
      accessor: 'dropoutRate', 
      width: '80px',
      render: (value: number) => ColumnRenderers.rate(value, 'dropout')
    },
    { 
      header: 'Punto cru00edtico', 
      accessor: 'criticalPoints',
      width: '100px', 
      render: (criticalPoints: any[]) => {
        if (!criticalPoints || !criticalPoints.length) return '-';
        const maxPoint = criticalPoints.reduce((max, point) => 
          point.dropoutCount > max.dropoutCount ? point : max, criticalPoints[0]);
        return `Du00eda ${maxPoint.timePoint}`;
      }
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Anu00e1lisis de Abandono</h1>
        <p>Estadu00edsticas detalladas sobre tasas de abandono y puntos cru00edticos</p>
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
            <Link href="/admin/stats/revenue" className={styles.navLink}>
              Ingresos
            </Link>
            <Link href="/admin/stats/dropout" className={`${styles.navLink} ${styles.active}`}>
              Abandonos
            </Link>
            <Link href="/admin/stats/demographics" className={styles.navLink}>
              Demografu00eda
            </Link>
          </nav>
        </div>

        {/* Contenido principal */}
        <div className={styles.mainContent}>
          {/* Tarjetas de mu00e9tricas principales */}
          <StatCardGrid>
            <StatCard 
              title="Tasa de Abandono" 
              value={dropoutData?.overallDropoutRate || 0}
              format="percentage"
              subtext="Promedio global"
            />
            <StatCard 
              title="Total Abandonos" 
              value={dropoutData?.dropoutRates.reduce((sum, course) => sum + course.dropoutCount, 0) || 0}
              format="number"
              subtext="Todos los cursos"
            />
            <StatCard 
              title="Motivo Principal" 
              value={dropoutData?.dropoutReasons[0]?.reason || '-'}
              format="none"
              subtext={`${dropoutData?.dropoutReasons[0]?.percentage || 0}% de casos`}
            />
            <StatCard 
              title="Cursos con Abandono" 
              value={dropoutData?.dropoutRates.filter(c => c.dropoutCount > 0).length || 0}
              format="number"
              subtext={`De ${dropoutData?.dropoutRates.length || 0} cursos`}
            />
          </StatCardGrid>

          {/* Gru00e1ficos de abandono */}
          <div className={styles.section}>
            <h2>Tendencia de Abandono</h2>
            <LineChart 
              title="Evoluciu00f3n de la Tasa de Abandono"
              data={prepareDropoutTrendData()}
            />
          </div>

          <div className={styles.section}>
            <h2>Comparativa entre Cursos</h2>
            <BarChart 
              title="Tasas Iniciales vs. Actuales"
              data={prepareCourseComparisonData()}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className={styles.section}>
              <h2>Motivos de Abandono</h2>
              <BarChart 
                title="Principales Razones"
                data={prepareDropoutReasonsData()}
              />
            </div>

            {selectedCourse && (
              <div className={styles.section}>
                <h2>
                  Puntos Cru00edticos: {dropoutData?.dropoutRates.find(c => c.courseId === selectedCourse)?.courseName}
                  <button 
                    onClick={() => setSelectedCourse(null)}
                    className="text-sm text-blue-500 ml-2 hover:underline"
                  >
                    u2715 Cerrar
                  </button>
                </h2>
                <BarChart 
                  title="Du00edas con Mayor Abandono"
                  data={prepareCriticalPointsData()}
                />
              </div>
            )}
          </div>

          {/* Tabla detallada */}
          <div className={styles.section}>
            <h2>Detalles por Curso</h2>
            <p className="text-sm text-gray-600 mb-3">Haga click en el nombre de un curso para ver sus puntos cru00edticos</p>
            <DataTable 
              columns={dropoutColumns}
              data={dropoutData?.dropoutRates || []}
              emptyMessage="No hay datos de abandono disponibles"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 