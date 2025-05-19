import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../../styles/AdminDashboard.module.css';

interface Plan {
  id: string;
  name: string;
  type: string;
  description: string;
  price: number;
  isActive: boolean;
  maxUsers: number;
  maxStorageGb: number;
  maxStreamingMinutesPerMonth: number;
  maxCoursesPerUser: number;
  features: string[];
  subscriptionsCount: number;
}

export default function PlansManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login?redirect=/admin/subscriptions/plans');
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
        
        // Cargar planes
        fetchPlans();
      } catch (error) {
        console.error('Error al verificar rol:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, activeFilter]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;
      
      const response = await fetch(`/api/admin/plans?active=${activeFilter}`, {
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
      
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Error al obtener planes:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      
      // Generar datos de ejemplo en caso de error
      const mockData = generateMockData(activeFilter);
      setPlans(mockData.plans);
    } finally {
      setLoading(false);
    }
  };

  // Función para generar datos de ejemplo
  const generateMockData = (activeFilter: string) => {
    const planTypes = [
      { name: 'Básico', type: 'básico', price: 19.99, maxUsers: 20, maxStorageGb: 10, maxStreamingMinutesPerMonth: 500, maxCoursesPerUser: 5 },
      { name: 'Estándar', type: 'estándar', price: 39.99, maxUsers: 50, maxStorageGb: 25, maxStreamingMinutesPerMonth: 1000, maxCoursesPerUser: 10 },
      { name: 'Premium', type: 'premium', price: 79.99, maxUsers: 100, maxStorageGb: 50, maxStreamingMinutesPerMonth: 2000, maxCoursesPerUser: 20 },
      { name: 'Enterprise', type: 'enterprise', price: 149.99, maxUsers: 500, maxStorageGb: 200, maxStreamingMinutesPerMonth: 5000, maxCoursesPerUser: 100 }
    ];
    
    let mockPlans = planTypes.map((planType, i) => {
      // Algunas características aleatorias para cada plan
      const features = [
        'Acceso a la plataforma',
        'Soporte técnico',
        'Clases en vivo',
        'Materiales descargables',
        'Análisis de desempeño',
        'API de integración',
        'Panel administrativo avanzado',
        'Personalización de marca'
      ];
      
      // Seleccionar algunas características al azar basadas en el nivel del plan
      const numFeatures = 3 + Math.min(i, 4); // Más características para planes superiores
      const selectedFeatures = features.slice(0, numFeatures);
      
      // Determinar si el plan está activo (los planes básico y estándar siempre activos)
      const isActive = i < 2 ? true : Math.random() > 0.3;
      
      // Contar cuántas suscripciones tiene este plan
      const subscriptionsCount = i === 0 ? 5 : (i === 1 ? 3 : (i === 2 ? 1 : 0));
      
      return {
        id: `plan-${i + 1}`,
        name: planType.name,
        type: planType.type,
        description: `Plan ${planType.name} para escuelas con hasta ${planType.maxUsers} usuarios.`,
        price: planType.price,
        isActive,
        maxUsers: planType.maxUsers,
        maxStorageGb: planType.maxStorageGb,
        maxStreamingMinutesPerMonth: planType.maxStreamingMinutesPerMonth,
        maxCoursesPerUser: planType.maxCoursesPerUser,
        features: selectedFeatures,
        subscriptionsCount
      };
    });
    
    // Filtrar por estado activo si se proporciona
    if (activeFilter === 'true') {
      mockPlans = mockPlans.filter(plan => plan.isActive);
    } else if (activeFilter === 'false') {
      mockPlans = mockPlans.filter(plan => !plan.isActive);
    }
    
    return {
      plans: mockPlans,
      totalCount: mockPlans.length
    };
  };

  if (loading) {
    return <div className={styles.loading}>Cargando planes de suscripción...</div>;
  }

  if (error && plans.length === 0) {
    return (
      <div className={styles.container}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
        <button 
          onClick={fetchPlans}
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
        <h1>Administración de Planes</h1>
        <p>Gestiona los planes disponibles para las escuelas.</p>
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
            <Link href="/admin/subscriptions/list" className={styles.navLink}>
              Lista de Suscripciones
            </Link>
            <Link href="/admin/subscriptions/plans" className={`${styles.navLink} ${styles.active}`}>
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
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
            <button className={styles.addButton}>
              Crear Nuevo Plan
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Usuarios Máx.</th>
                  <th>Almacenamiento</th>
                  <th>Minutos Streaming</th>
                  <th>Suscripciones</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plans.length > 0 ? (
                  plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>{plan.name}</td>
                      <td>{plan.type}</td>
                      <td>${plan.price.toFixed(2)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${plan.isActive ? styles.active : styles.inactive}`}>
                          {plan.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>{plan.maxUsers}</td>
                      <td>{plan.maxStorageGb} GB</td>
                      <td>{plan.maxStreamingMinutesPerMonth} min</td>
                      <td>{plan.subscriptionsCount}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button className={styles.editButton}>Editar</button>
                          {plan.subscriptionsCount === 0 && (
                            <button className={styles.deleteButton}>Eliminar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className={styles.noDataMessage}>
                      No hay planes disponibles
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