import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../components/AdminNavigation';

interface School {
  id: string;
  name: string;
  email: string;
  city: string;
  country: string;
  status: 'active' | 'pending' | 'inactive';
  subscriptionType: string;
  studentsCount: number;
  teachersCount: number;
  storageUsedGb: number;
}

export default function SchoolsManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login?redirect=/admin/schools');
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
        
        // Cargar escuelas
        fetchSchools();
      } catch (error) {
        console.error('Error al verificar rol:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, statusFilter]);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;
      
      const response = await fetch(`/api/admin/schools?status=${statusFilter}`, {
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
      
      setSchools(data.schools || []);
    } catch (error) {
      console.error('Error al obtener escuelas:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando escuelas...</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
        <button 
          onClick={fetchSchools}
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
        <h1>Gestión de Escuelas</h1>
        <p>Administra las escuelas registradas en la plataforma.</p>
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
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="pending">Pendientes</option>
                <option value="inactive">Inactivas</option>
              </select>
            </div>
            <button className={styles.addButton}>
              Registrar Nueva Escuela
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Plan</th>
                  <th>Estudiantes</th>
                  <th>Profesores</th>
                  <th>Almacenamiento</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {schools.length > 0 ? (
                  schools.map((school) => (
                    <tr key={school.id}>
                      <td>{school.name}</td>
                      <td>{school.email}</td>
                      <td>{`${school.city}, ${school.country}`}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[school.status]}`}>
                          {school.status === 'active' ? 'Activa' : 
                           school.status === 'pending' ? 'Pendiente' : 'Inactiva'}
                        </span>
                      </td>
                      <td>{school.subscriptionType}</td>
                      <td>{school.studentsCount}</td>
                      <td>{school.teachersCount}</td>
                      <td>{school.storageUsedGb.toFixed(2)} GB</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <Link 
                            href={`/admin/subscriptions/school/${school.id}`} 
                            className={styles.viewButton}
                          >
                            Ver Detalles
                          </Link>
                          <button className={styles.editButton}>Editar</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className={styles.noDataMessage}>
                      No hay escuelas disponibles con los filtros seleccionados
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