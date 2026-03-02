import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { BarChart, DoughnutChart } from '../../../components/stats/ChartComponents';
import { StatCard, StatCardGrid } from '../../../components/stats/StatCards';
import DataTable, { ColumnRenderers } from '../../../components/stats/DataTable';
import styles from '../../../styles/Stats.module.css';

// Tipos para las respuestas de la API
interface DemographicsData {
  ageDistribution: {
    under18: number;
    age18to25: number;
    age26to35: number;
    over36: number;
    unknown: number;
  };
  ageDistributionByCourse: {
    courseId: string;
    courseName: string;
    under18: number;
    age18to25: number;
    age26to35: number;
    over36: number;
    unknown: number;
    totalStudents: number;
  }[];
  genderDistribution?: {
    male: number;
    female: number;
    nonBinary: number;
    unknown: number;
  };
  locationDistribution?: {
    location: string;
    count: number;
    percentage: number;
  }[];
  dominantAgeGroup: string;
  averageAge: number;
}

export default function DemographicsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demographicsData, setDemographicsData] = useState<DemographicsData | null>(null);

  // Verificar autentificación al cargar la página
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login?redirect=/admin/stats/demographics');
      return;
    }

    fetchDemographicsData();
  }, []);

  // Cargar datos demográficos desde la API
  const fetchDemographicsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/api/admin-stats/demographics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDemographicsData(data);
    } catch (error: any) {
      console.error('Error al cargar datos demográficos:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Si está cargando mostrar mensaje
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando datos demográficos...</div>;
  }

  // Si hay error mostrar mensaje
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <h1 className="text-xl font-semibold mb-4">Error</h1>
        <p className="text-red-500 mb-4">{error}</p>
        <button 
          onClick={fetchDemographicsData}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Preparar datos para los gráficos
  const prepareAgeDistributionData = () => {
    if (!demographicsData?.ageDistribution) return { labels: [], datasets: [] };
    
    return {
      labels: ['<18', '18-25', '26-35', '36+', 'Desconocido'],
      datasets: [
        {
          data: [
            demographicsData.ageDistribution.under18,
            demographicsData.ageDistribution.age18to25,
            demographicsData.ageDistribution.age26to35,
            demographicsData.ageDistribution.over36,
            demographicsData.ageDistribution.unknown
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

  const prepareGenderDistributionData = () => {
    if (!demographicsData?.genderDistribution) return { labels: [], datasets: [] };
    
    return {
      labels: ['Masculino', 'Femenino', 'No binario', 'Desconocido'],
      datasets: [
        {
          data: [
            demographicsData.genderDistribution.male,
            demographicsData.genderDistribution.female,
            demographicsData.genderDistribution.nonBinary,
            demographicsData.genderDistribution.unknown
          ],
          backgroundColor: [
            'rgba(49, 130, 206, 0.7)',
            'rgba(236, 72, 153, 0.7)', 
            'rgba(139, 92, 246, 0.7)',
            'rgba(113, 128, 150, 0.7)'
          ],
        }
      ]
    };
  };

  const prepareLocationDistributionData = () => {
    if (!demographicsData?.locationDistribution) return { labels: [], datasets: [] };
    
    // Ordenar ubicaciones por cantidad
    const sortedLocations = [...demographicsData.locationDistribution]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8
    
    return {
      labels: sortedLocations.map(location => location.location),
      datasets: [
        {
          label: 'Estudiantes por ubicación',
          data: sortedLocations.map(location => location.count),
          backgroundColor: 'rgba(49, 130, 206, 0.7)',
        }
      ]
    };
  };

  // Definir columnas para la tabla de demografía por curso
  const courseAgeColumns = [
    { header: 'Curso', accessor: 'courseName' },
    { header: 'Total', accessor: 'totalStudents', width: '70px' },
    { 
      header: '<18', 
      accessor: 'under18', 
      width: '60px',
      render: (value: number, row: any) => {
        const percentage = row.totalStudents ? Math.round((value / row.totalStudents) * 100) : 0;
        return `${value} (${percentage}%)`;  
      }
    },
    { 
      header: '18-25', 
      accessor: 'age18to25', 
      width: '70px',
      render: (value: number, row: any) => {
        const percentage = row.totalStudents ? Math.round((value / row.totalStudents) * 100) : 0;
        return `${value} (${percentage}%)`;  
      }
    },
    { 
      header: '26-35', 
      accessor: 'age26to35', 
      width: '70px',
      render: (value: number, row: any) => {
        const percentage = row.totalStudents ? Math.round((value / row.totalStudents) * 100) : 0;
        return `${value} (${percentage}%)`;  
      }
    },
    { 
      header: '36+', 
      accessor: 'over36', 
      width: '70px',
      render: (value: number, row: any) => {
        const percentage = row.totalStudents ? Math.round((value / row.totalStudents) * 100) : 0;
        return `${value} (${percentage}%)`;  
      }
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Demografía de Estudiantes</h1>
        <p>Análisis detallado de la distribución demográfica de los estudiantes</p>
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
            <Link href="/admin/stats/performance" className={styles.navLink}>
              Profesores
            </Link>
            <Link href="/admin/stats/revenue" className={styles.navLink}>
              Ingresos
            </Link>
            <Link href="/admin/stats/dropout" className={styles.navLink}>
              Abandonos
            </Link>
            <Link href="/admin/stats/demographics" className={`${styles.navLink} ${styles.active}`}>
              Demografía
            </Link>
          </nav>
        </div>

        {/* Contenido principal */}
        <div className={styles.mainContent}>
          {/* Tarjetas de métricas principales */}
          <StatCardGrid>
            <StatCard 
              title="Grupo Dominante" 
              value={demographicsData?.dominantAgeGroup || '-'}
              format="none"
              subtext="Grupo de edad mayoritario"
            />
            <StatCard 
              title="Edad Promedio" 
              value={demographicsData?.averageAge || 0}
              format="number"
              subtext="Todos los estudiantes"
            />
            {demographicsData?.genderDistribution && (
              <StatCard 
                title="Distribución de Género" 
                value={Math.round((demographicsData.genderDistribution.male / 
                  (demographicsData.genderDistribution.male + 
                   demographicsData.genderDistribution.female + 
                   demographicsData.genderDistribution.nonBinary)) * 100) || 0}
                format="percentage"
                subtext="Estudiantes masculinos"
              />
            )}
            {demographicsData?.locationDistribution && (
              <StatCard 
                title="Ubicación Principal" 
                value={demographicsData.locationDistribution[0]?.location || '-'}
                format="none"
                subtext={`${demographicsData.locationDistribution[0]?.percentage || 0}% de estudiantes`}
              />
            )}
          </StatCardGrid>

          {/* Gráficos de demografía */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className={styles.section}>
              <h2>Distribución por Edad</h2>
              <DoughnutChart 
                title="Grupos de Edad"
                data={prepareAgeDistributionData()}
              />
            </div>

            {demographicsData?.genderDistribution && (
              <div className={styles.section}>
                <h2>Distribución por Género</h2>
                <DoughnutChart 
                  title="Porcentaje por Género"
                  data={prepareGenderDistributionData()}
                />
              </div>
            )}
          </div>

          {demographicsData?.locationDistribution && (
            <div className={styles.section}>
              <h2>Distribución Geográfica</h2>
              <BarChart 
                title="Principales Ubicaciones"
                data={prepareLocationDistributionData()}
              />
            </div>
          )}

          {/* Tabla detallada */}
          <div className={styles.section}>
            <h2>Demografía por Curso</h2>
            <DataTable 
              columns={courseAgeColumns}
              data={demographicsData?.ageDistributionByCourse || []}
              emptyMessage="No hay datos demográficos disponibles"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 