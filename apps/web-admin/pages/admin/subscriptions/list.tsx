import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../../components/AdminNavigation';

interface Subscription {
  id: string;
  schoolName: string;
  schoolId: string;
  planName: string;
  planType: string;
  status: string;
  startDate: string;
  endDate: string;
  currentStorageGb: number;
  currentStreamingMinutes: number;
}

export default function SubscriptionsManager() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Fix hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      checkAuth();
      fetchSubscriptions();
    }
  }, [mounted, statusFilter]);

  const checkAuth = () => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }
  };

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;
      
      const response = await fetch(`/api/admin/subscriptions/list?status=${statusFilter}`, {
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
      
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      console.error('Error al obtener suscripciones:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.dashboardHeader}>
          <h1>Gestión de Suscripciones</h1>
          <p>Administra las suscripciones de todas las escuelas.</p>
        </div>
        <div className={styles.content}>
          <AdminNavigation userRole="super_admin" />
          <div className={styles.mainContent}>
            <div className={styles.loading}>Cargando suscripciones...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && subscriptions.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.dashboardHeader}>
          <h1>Error</h1>
          <p className={styles.error}>{error}</p>
          <button 
            onClick={fetchSubscriptions}
            className={styles.refreshButton}
          >
            Reintentar
          </button>
          <Link href="/admin/dashboard" className={styles.backButton}>
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Gestión de Suscripciones</h1>
        <p>Administra las suscripciones de todas las escuelas.</p>
      </div>

      <div className={styles.content}>
        <AdminNavigation userRole="super_admin" />

        <div className={styles.mainContent}>
          <div className={styles.actionsRow}>
            <div className={styles.filterContainer}>
              <label htmlFor="statusFilter">Estado: </label>
              <select 
                id="statusFilter" 
                className={styles.select}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
                <option value="suspended">Suspendidas</option>
              </select>
            </div>
            <div className={styles.statsContainer}>
              <span className={styles.statItem}>
                Total: {subscriptions.length} suscripción{subscriptions.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Escuela</th>
                  <th>Plan</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Storage (GB)</th>
                  <th>Streaming (min)</th>
                  <th>Fecha Inicio</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length > 0 ? (
                  subscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td>{subscription.schoolName}</td>
                      <td>{subscription.planName}</td>
                      <td style={{ textTransform: 'capitalize' }}>{subscription.planType}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${
                          subscription.status === 'active' ? styles.active : 
                          subscription.status === 'inactive' ? styles.inactive : styles.suspended
                        }`}>
                          {subscription.status === 'active' ? 'Activa' : 
                           subscription.status === 'inactive' ? 'Inactiva' : 'Suspendida'}
                        </span>
                      </td>
                      <td>{subscription.currentStorageGb?.toFixed(2) || '0.00'}</td>
                      <td>{subscription.currentStreamingMinutes?.toFixed(0) || '0'}</td>
                      <td>{new Date(subscription.startDate).toLocaleDateString()}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <Link 
                            href={`/admin/subscriptions/school/${subscription.schoolId}`} 
                            className={styles.viewButton}
                            title="Ver detalles de la suscripción"
                          >
                            Ver
                          </Link>
                          <Link 
                            href={`/admin/schools`} 
                            className={styles.editButton}
                            title="Gestionar escuela"
                          >
                            Gestionar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className={styles.noDataMessage}>
                      No hay suscripciones disponibles
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 