import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../../styles/AdminDashboard.module.css';

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

export default function SubscriptionsList() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login?redirect=/admin/subscriptions/list');
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
        
        // Cargar suscripciones
        fetchSubscriptions();
      } catch (error) {
        console.error('Error al verificar rol:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, statusFilter]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
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
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error('Error al obtener suscripciones:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      
      // Datos de ejemplo para desarrollo
      const mockData = generateMockData();
      setSubscriptions(mockData.subscriptions);
      setTotalCount(mockData.totalCount);
    } finally {
      setLoading(false);
    }
  };

  // Función para generar datos de ejemplo
  const generateMockData = () => {
    const statuses = ['active', 'trial', 'expired', 'pending'];
    const planTypes = ['Básico', 'Estándar', 'Premium'];
    
    const mockSubscriptions = Array.from({ length: 10 }, (_, i) => {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const planType = planTypes[Math.floor(Math.random() * planTypes.length)];
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 6));
      
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      return {
        id: `sub-${i + 1}`,
        schoolName: `Escuela Ejemplo ${i + 1}`,
        schoolId: `school-${i + 1}`,
        planName: `Plan ${planType}`,
        planType: planType.toLowerCase(),
        status,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        currentStorageGb: Math.random() * 50,
        currentStreamingMinutes: Math.floor(Math.random() * 1000)
      };
    });
    
    return {
      subscriptions: mockSubscriptions,
      totalCount: mockSubscriptions.length
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Activa';
      case 'trial': return 'Prueba';
      case 'expired': return 'Expirada';
      case 'pending': return 'Pendiente';
      default: return status;
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando lista de suscripciones...</div>;
  }

  if (error && subscriptions.length === 0) {
    return (
      <div className={styles.container}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
        <button 
          onClick={fetchSubscriptions}
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
        <h1>Lista de Suscripciones</h1>
        <p>Administra todas las suscripciones de las escuelas</p>
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
            <Link href="/admin/subscriptions" className={styles.navLink}>
              Suscripciones
            </Link>
            <Link href="/admin/subscriptions/list" className={`${styles.navLink} ${styles.active}`}>
              Lista de Suscripciones
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
                <option value="trial">Prueba</option>
                <option value="expired">Expiradas</option>
                <option value="pending">Pendientes</option>
              </select>
            </div>
            <span className={styles.resultsCount}>
              Mostrando {subscriptions.length} de {totalCount} suscripciones
            </span>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Escuela</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Fecha Inicio</th>
                  <th>Fecha Fin</th>
                  <th>Almacenamiento</th>
                  <th>Streaming</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length > 0 ? (
                  subscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td>{subscription.schoolName}</td>
                      <td>
                        <span 
                          className={`${styles.planBadge} ${styles[subscription.planType.toLowerCase()]}`}
                        >
                          {subscription.planName}
                        </span>
                      </td>
                      <td>
                        <span 
                          className={`${styles.statusBadge} ${styles[subscription.status]}`}
                        >
                          {getStatusLabel(subscription.status)}
                        </span>
                      </td>
                      <td>{formatDate(subscription.startDate)}</td>
                      <td>{formatDate(subscription.endDate)}</td>
                      <td>{subscription.currentStorageGb.toFixed(2)} GB</td>
                      <td>{Math.round(subscription.currentStreamingMinutes)} min</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <Link 
                            href={`/admin/subscriptions/school/${subscription.schoolId}`} 
                            className={styles.viewButton}
                          >
                            Ver Detalles
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className={styles.noDataMessage}>
                      No hay suscripciones disponibles con los filtros seleccionados
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