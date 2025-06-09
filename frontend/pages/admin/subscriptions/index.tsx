import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../../components/AdminNavigation';

interface SubscriptionStats {
  totalSubscriptions: number;
  activePlans: number;
  subscriptionsByPlan: {
    _id: string;
    count: number;
    avgStorageUsed: number;
    avgStreamingMinutes: number;
  }[];
  subscriptionsByStatus: {
    _id: string;
    count: number;
  }[];
  topSchoolsByStorage: {
    _id: string;
    name: string;
    storageUsedGb: number;
  }[];
  error?: string;
}

export default function SubscriptionsManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login?redirect=/admin/subscriptions');
        return;
      }

      // Verificar si es super admin
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        
        // Verificar si tiene el rol super_admin
        const role = Array.isArray(decoded.role) 
          ? decoded.role.find((r: string) => r.toLowerCase().includes('super_admin'))
          : decoded.role;
        
        if (!role || !role.toLowerCase().includes('super_admin')) {
          router.push('/admin/dashboard');
          return;
        }
        
        // Cargar estadísticas
        fetchSubscriptionStats();
      } catch (error) {
        console.error('Error al verificar rol:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, isMounted]);

  const fetchSubscriptionStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) {
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/admin/stats/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setStats(data);
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      setStats(null);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  if (!isMounted || (initialLoading && isMounted)) {
    return <div className={styles.loading}>Verificando sesión...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Gestión de Planes y Suscripciones</h1>
        <p>Administra los planes disponibles, monitorea las suscripciones activas y analiza el uso de recursos por escuela.</p>
      </div>

      <div className={styles.content}>
        <AdminNavigation userRole="super_admin" />

        <div className={styles.mainContent}>
          {loading && <div className={styles.loadingMessage}>Cargando estadísticas de suscripciones...</div>}
          
          {error && (
            <div className={styles.errorMessage}>
              <p>Error al cargar datos: {error}</p>
              <button 
                onClick={fetchSubscriptionStats}
                className={styles.retryButton}
                disabled={loading}
              >
                {loading ? 'Reintentando...' : 'Reintentar'}
              </button>
            </div>
          )}

          {!loading && !error && stats && (
            <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>Suscripciones Totales</h3>
              <div className={styles.statValueContainer}>
                    <p className={styles.statValue}>{stats.totalSubscriptions || 0}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <h3>Planes Activos</h3>
              <div className={styles.statValueContainer}>
                    <p className={styles.statValue}>{stats.activePlans || 0}</p>
              </div>
            </div>
          </div>

          <div className={styles.statsSection}>
            <h2>Suscripciones por Plan</h2>
            <div className={styles.tableContainer}>
              <table className={styles.statsTable}>
                <thead>
                  <tr>
                    <th>Tipo de Plan</th>
                    <th>Cantidad</th>
                    <th>Almacenamiento Promedio (GB)</th>
                    <th>Streaming Promedio (min)</th>
                  </tr>
                </thead>
                <tbody>
                      {stats.subscriptionsByPlan && stats.subscriptionsByPlan.length > 0 ? (
                    stats.subscriptionsByPlan.map((item) => (
                      <tr key={item._id}>
                        <td>{item._id}</td>
                        <td>{item.count}</td>
                        <td>{item.avgStorageUsed.toFixed(2)}</td>
                        <td>{item.avgStreamingMinutes.toFixed(0)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className={styles.noDataMessage}>No hay datos disponibles</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.statsSection}>
            <h2>Suscripciones por Estado</h2>
            <div className={styles.tableContainer}>
              <table className={styles.statsTable}>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                      {stats.subscriptionsByStatus && stats.subscriptionsByStatus.length > 0 ? (
                    stats.subscriptionsByStatus.map((item) => (
                      <tr key={item._id}>
                        <td>{item._id}</td>
                        <td>{item.count}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className={styles.noDataMessage}>No hay datos disponibles</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.statsSection}>
            <h2>Escuelas con Mayor Almacenamiento</h2>
            <div className={styles.tableContainer}>
              <table className={styles.statsTable}>
                <thead>
                  <tr>
                    <th>Escuela</th>
                    <th>Almacenamiento Usado (GB)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                      {stats.topSchoolsByStorage && stats.topSchoolsByStorage.length > 0 ? (
                    stats.topSchoolsByStorage.map((school) => (
                      <tr key={school._id}>
                        <td>{school.name}</td>
                        <td>{school.storageUsedGb.toFixed(2)}</td>
                        <td>
                          <Link href={`/admin/subscriptions/school/${school._id}`} className={styles.viewButton}>
                            Ver Detalles
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className={styles.noDataMessage}>No hay datos disponibles</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <Link href="/admin/subscriptions/list" className={styles.primaryButton}>
              Ver todas las suscripciones
            </Link>
            <Link href="/admin/subscriptions/plans" className={styles.primaryButton}>
              Administrar planes
            </Link>
          </div>
            </>
          )}
          
          {!loading && !error && !stats && (
            <div className={styles.noDataMessage}>
              No se pudieron cargar las estadísticas de suscripciones o no hay datos disponibles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 