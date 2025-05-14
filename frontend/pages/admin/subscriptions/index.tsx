import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../../styles/AdminDashboard.module.css';

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

  useEffect(() => {
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
  }, [router]);

  const fetchSubscriptionStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;
      
      const response = await fetch('/api/admin-stats/subscriptions', {
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
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando información de suscripciones...</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
        <button 
          onClick={fetchSubscriptionStats}
          className={styles.refreshButton}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Gestión de Planes y Suscripciones</h1>
        <p>Administra los planes disponibles, monitorea las suscripciones activas y analiza el uso de recursos por escuela.</p>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <nav className={styles.nav}>
            <Link href="/" className={styles.navLink}>
              Inicio
            </Link>
            <Link href="/admin/dashboard" className={styles.navLink}>
              Dashboard
            </Link>
            <Link href="/admin/subscriptions" className={`${styles.navLink} ${styles.active}`}>
              Suscripciones
            </Link>
            <Link href="/admin/subscriptions/plans" className={styles.navLink}>
              Planes
            </Link>
            <Link href="/admin/users" className={styles.navLink}>
              Usuarios
            </Link>
            <Link href="/admin/schools" className={styles.navLink}>
              Escuelas
            </Link>
          </nav>
        </div>

        <div className={styles.mainContent}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>Suscripciones Totales</h3>
              <p className={styles.statValue}>{stats?.totalSubscriptions || 0}</p>
            </div>
            <div className={styles.statCard}>
              <h3>Planes Activos</h3>
              <p className={styles.statValue}>{stats?.activePlans || 0}</p>
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
                  {stats?.subscriptionsByPlan?.map((item) => (
                    <tr key={item._id}>
                      <td>{item._id}</td>
                      <td>{item.count}</td>
                      <td>{item.avgStorageUsed.toFixed(2)}</td>
                      <td>{item.avgStreamingMinutes.toFixed(0)}</td>
                    </tr>
                  ))}
                  {(!stats?.subscriptionsByPlan || stats.subscriptionsByPlan.length === 0) && (
                    <tr>
                      <td colSpan={4}>No hay datos disponibles</td>
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
                  {stats?.subscriptionsByStatus?.map((item) => (
                    <tr key={item._id}>
                      <td>{item._id}</td>
                      <td>{item.count}</td>
                    </tr>
                  ))}
                  {(!stats?.subscriptionsByStatus || stats.subscriptionsByStatus.length === 0) && (
                    <tr>
                      <td colSpan={2}>No hay datos disponibles</td>
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
                  {stats?.topSchoolsByStorage?.map((school) => (
                    <tr key={school._id}>
                      <td>{school.name}</td>
                      <td>{school.storageUsedGb.toFixed(2)}</td>
                      <td>
                        <Link href={`/admin/subscriptions/school/${school._id}`} className={styles.viewButton}>
                          Ver Detalles
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {(!stats?.topSchoolsByStorage || stats.topSchoolsByStorage.length === 0) && (
                    <tr>
                      <td colSpan={3}>No hay datos disponibles</td>
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
        </div>
      </div>
    </div>
  );
} 