import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { BarChart, LineChart } from '../../../components/stats/ChartComponents';
import { StatCard, StatCardGrid } from '../../../components/stats/StatCards';
import DataTable, { ColumnRenderers } from '../../../components/stats/DataTable';
import styles from '../../../styles/Stats.module.css';

// Tipos para las respuestas de la API
interface PerformanceData {
  teacherPerformance: {
    teacherId: string;
    teacherName: string;
    avgRetentionRate: number;
    avgAttendanceRate: number;
    coursesCount: number;
    studentsCount: number;
    satisfaction?: number;
    courseCompletionRate?: number;
    monthlyTrend?: {
      month: string;
      retention: number;
      attendance: number;
    }[];
  }[];
  bestTeachers: {
    teacherId: string;
    teacherName: string;
    metric: string;
    value: number;
  }[];
  overallSatisfaction: number;
  overallAttendance: number;
}

export default function PerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);

  // Verificar autentificación al cargar la página
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login?redirect=/admin/stats/performance');
      return;
    }

    fetchPerformanceData();
  }, []);

  // Cargar datos de rendimiento desde la API
  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      const response = await fetch('/api/admin-stats/performance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPerformanceData(data);
    } catch (error: any) {
      console.error('Error al cargar datos de rendimiento:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Si está cargando mostrar mensaje
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando datos de rendimiento...</div>;
  }

  // Si hay error mostrar mensaje
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={fetchPerformanceData}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Preparar datos para los gráficos
  const prepareRetentionAttendanceData = () => {
    if (!performanceData?.teacherPerformance) return { labels: [], datasets: [] };
    
    // Ordenar profesores por tasa de retención
    const sortedTeachers = [...performanceData.teacherPerformance]
      .sort((a, b) => b.avgRetentionRate - a.avgRetentionRate)
      .slice(0, 10); // Top 10
    
    return {
      labels: sortedTeachers.map(teacher => teacher.teacherName),
      datasets: [
        {
          label: 'Retención',
          data: sortedTeachers.map(teacher => teacher.avgRetentionRate),
          backgroundColor: 'rgba(49, 130, 206, 0.7)',
        },
        {
          label: 'Asistencia',
          data: sortedTeachers.map(teacher => teacher.avgAttendanceRate),
          backgroundColor: 'rgba(72, 187, 120, 0.7)',
        }
      ]
    };
  };

  const prepareTeacherTrendData = () => {
    if (!selectedTeacher || !performanceData?.teacherPerformance) 
      return { labels: [], datasets: [] };
    
    const teacherData = performanceData.teacherPerformance.find(
      t => t.teacherId === selectedTeacher
    );
    
    if (!teacherData?.monthlyTrend) return { labels: [], datasets: [] };
    
    return {
      labels: teacherData.monthlyTrend.map(item => item.month),
      datasets: [
        {
          label: 'Retención',
          data: teacherData.monthlyTrend.map(item => item.retention),
          borderColor: 'rgba(49, 130, 206, 0.7)',
        },
        {
          label: 'Asistencia',
          data: teacherData.monthlyTrend.map(item => item.attendance),
          borderColor: 'rgba(72, 187, 120, 0.7)',
        }
      ]
    };
  };

  // Columnas para la tabla de profesores
  const performanceColumns = [
    { 
      header: 'Profesor', 
      accessor: 'teacherName',
      render: (value: string, row: any) => (
        <button 
          onClick={() => setSelectedTeacher(row.teacherId)}
          className="text-blue-500 hover:underline"
        >
          {value}
        </button>
      )
    },
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
    { 
      header: 'Satisfacción', 
      accessor: 'satisfaction', 
      width: '100px',
      render: (value: number) => value ? ColumnRenderers.rate(value, 'retention') : '-'
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Rendimiento de Profesores</h1>
        <p>Análisis detallado del rendimiento de profesores y métricas de desempeño</p>
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
            <Link href="/admin/stats/retention" className={styles.navLink}>
              Retención
            </Link>
            <Link href="/admin/stats/performance" className={`${styles.navLink} ${styles.active}`}>
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
              title="Asistencia Promedio" 
              value={performanceData?.overallAttendance || 0}
              format="percentage"
              subtext="Todos los profesores"
            />
            <StatCard 
              title="Satisfacción" 
              value={performanceData?.overallSatisfaction || 0}
              format="percentage"
              subtext="Promedio general"
            />
            <StatCard 
              title="Total Profesores" 
              value={performanceData?.teacherPerformance.length || 0}
              format="number"
              subtext="Profesores activos"
            />
            <StatCard 
              title="Mejor Profesor" 
              value={performanceData?.bestTeachers[0]?.teacherName || '-'}
              format="none"
              subtext={performanceData?.bestTeachers[0]?.metric || ''}
            />
          </StatCardGrid>

          {/* Gráfico comparativo */}
          <div className={styles.section}>
            <h2>Comparativa de Rendimiento</h2>
            <BarChart 
              title="Retención y Asistencia por Profesor"
              data={prepareRetentionAttendanceData()}
              horizontal={true}
            />
          </div>

          {/* Gráfico de tendencia para profesor seleccionado */}
          {selectedTeacher && (
            <div className={styles.section}>
              <h2>
                Tendencia para {performanceData?.teacherPerformance.find(t => t.teacherId === selectedTeacher)?.teacherName}
                <button 
                  onClick={() => setSelectedTeacher(null)}
                  className="text-sm text-blue-500 ml-2 hover:underline"
                >
                  ✕ Cerrar
                </button>
              </h2>
              <LineChart 
                title="Evolución Mensual"
                data={prepareTeacherTrendData()}
              />
            </div>
          )}

          {/* Tabla detallada */}
          <div className={styles.section}>
            <h2>Detalles por Profesor</h2>
            <p className="text-sm text-gray-600 mb-3">Haga click en el nombre de un profesor para ver sus tendencias</p>
            <DataTable 
              columns={performanceColumns}
              data={performanceData?.teacherPerformance || []}
              emptyMessage="No hay datos de rendimiento disponibles"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 