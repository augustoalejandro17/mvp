import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import api from '../../utils/api-client';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../components/AdminNavigation';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

interface School {
  _id: string;
  name: string;
  description: string;
  logoUrl?: string;
  isPublic: boolean;
  admin?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  teachers?: any[];
  students?: any[];
  createdAt: string;
  timezone?: string;
  planId?: string;
  currentPlan?: {
    name: string;
    type: string;
    price: number;
  };
  currentSeats?: number;
  totalAllowedSeats?: number;
  extraSeats?: number;
  extraStorageGB?: number;
  extraStreamingHours?: number;
  totalStudents?: number;
  totalTeachers?: number;
  totalAdministratives?: number;
}

export default function SchoolsManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterVisibility, setFilterVisibility] = useState('');

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/');
        return;
      }

      try {
        const decoded: DecodedToken = jwtDecode(token);
        const role = decoded.role?.toLowerCase();
        
        // Only allow super_admin, school_owner, and administrative
        if (!role.includes('super_admin') && !role.includes('school_owner') && !role.includes('administrative')) {
          router.push('/admin/dashboard');
          return;
        }
        
        setUserRole(decoded.role);
        setUserId(decoded.sub);
        
        // Load schools based on role
        fetchSchools(decoded);
      } catch (error) {
        console.error('Error al verificar rol:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const fetchSchools = async (user: DecodedToken) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = Cookies.get('token');
      if (!token) return;
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const role = user.role?.toLowerCase();

      let endpoint = '';
      if (role.includes('super_admin')) {
        // Super admin can see all schools
        endpoint = `${apiUrl}/api/schools`;
      } else if (role.includes('school_owner')) {
        // School owner can only see their owned schools
        endpoint = `${apiUrl}/api/users/${user.sub}/owned-schools`;
      } else if (role.includes('administrative')) {
        // Administrative users can see their administered schools
        endpoint = `${apiUrl}/api/users/${user.sub}/administered-schools`;
      }

      const response = await api.get(endpoint);
      
      const schoolsData = response.data.schools || response.data || [];
      setSchools(schoolsData);
    } catch (error) {
      console.error('Error al obtener escuelas:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const refreshSchools = () => {
    if (userId && userRole) {
      const userData: DecodedToken = { sub: userId, role: userRole, email: '', name: '', iat: 0, exp: 0 };
      fetchSchools(userData);
    }
  };

  const isSuperAdmin = userRole?.toLowerCase().includes('super_admin');
  const isSchoolOwner = userRole?.toLowerCase().includes('school_owner');
  const isAdministrative = userRole?.toLowerCase().includes('administrative');
  const canManagePlans = isSuperAdmin || isSchoolOwner || isAdministrative;
  const filteredSchools = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return schools.filter((school) => {
      const matchesSearch =
        !q ||
        school.name?.toLowerCase().includes(q) ||
        school.description?.toLowerCase().includes(q) ||
        school.admin?.name?.toLowerCase().includes(q) ||
        school.admin?.email?.toLowerCase().includes(q);
      const matchesVisibility =
        !filterVisibility ||
        (filterVisibility === 'public' && school.isPublic) ||
        (filterVisibility === 'private' && !school.isPublic);
      return matchesSearch && matchesVisibility;
    });
  }, [schools, filterSearch, filterVisibility]);

  if (loading) {
    return <div className={styles.loading}>Cargando escuelas...</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <h1>Error</h1>
        <p className={styles.error}>{error}</p>
        <button 
          onClick={refreshSchools}
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
        <p>
          {isSuperAdmin 
            ? 'Administra todas las escuelas registradas en la plataforma.' 
            : 'Administra tus escuelas.'}
        </p>
      </div>

      <div className={styles.content}>
        <AdminNavigation userRole={userRole} />

        <div className={styles.mainContent}>
          <div className={`${styles.actionsRow} ${styles.coursesTopBar}`}>
            <div className={styles.statsContainer}>
              <span className={styles.statItem}>
                Mostrando {filteredSchools.length} de {schools.length} escuela{schools.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Link href="/school/create" className={styles.addButton}>
              Crear Nueva Escuela
            </Link>
          </div>

          <div className={`${styles.actionsRow} ${styles.schoolsFiltersRow}`}>
            <input
              type="text"
              placeholder="Buscar por nombre, descripción, admin o email..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className={`${styles.searchInput} ${styles.schoolsSearchInput}`}
            />

            <select
              value={filterVisibility}
              onChange={(e) => setFilterVisibility(e.target.value)}
              className={`${styles.filterSelect} ${styles.schoolsFilterSelect}`}
            >
              <option value="">Todas las visibilidades</option>
              <option value="public">Públicas</option>
              <option value="private">Privadas</option>
            </select>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Administrador</th>
                    <th>Plan Actual</th>
                    <th>Asientos</th>
                    <th>Estudiantes</th>
                    <th>Profesores</th>
                    <th>Zona Horaria</th>
                    <th>Fecha Creación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.length > 0 ? (
                    filteredSchools.map((school) => (
                      <tr key={school._id}>
                        <td>
                          <div className={styles.schoolName}>
                            {school.logoUrl && (
                              <img src={school.logoUrl} alt={school.name} className={styles.schoolLogo} />
                            )}
                            <span title={school.name}>{school.name}</span>
                            {school.isPublic && <span className={styles.publicBadge}>Pública</span>}
                          </div>
                        </td>
                        <td>
                          <div className={styles.description} title={school.description}>
                            {school.description}
                          </div>
                        </td>
                        <td>
                          <div className={styles.adminInfo}>
                            {school.admin ? (
                              <>
                                <span title={school.admin.name}>{school.admin.name}</span>
                                <small title={school.admin.email}>{school.admin.email}</small>
                              </>
                            ) : (
                              <span className={styles.noDataMuted}>
                                Sin asignar
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {school.currentPlan ? (
                            <div className={styles.planInfo}>
                              <span className={styles.planName}>{school.currentPlan.name}</span>
                              <small className={styles.planPrice}>
                                ${(school.currentPlan.price / 100).toFixed(2)}/mes
                              </small>
                            </div>
                          ) : (
                            <span className={styles.noPlanMuted}>
                              Sin plan
                            </span>
                          )}
                        </td>
                        <td className={styles.centeredCell}>
                          {school.currentSeats || 0}
                        </td>
                        <td className={styles.centeredCell}>{school.totalStudents || 0}</td>
                        <td className={styles.centeredCell}>{school.totalTeachers || 0}</td>
                        <td>{school.timezone || 'America/Bogota'}</td>
                        <td>{new Date(school.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className={styles.actionButtons}>
                            <Link 
                              href={`/school/${school._id}`} 
                              className={styles.viewButton}
                              title="Ver detalles de la escuela"
                            >
                              Ver
                            </Link>
                            <Link 
                              href={`/school/edit/${school._id}`} 
                              className={styles.editButton}
                              title="Editar escuela"
                            >
                              Editar
                            </Link>
                            {canManagePlans && (
                              <Link 
                                href={`/admin/subscriptions/school/${school._id}`} 
                                className={styles.planButton}
                                title="Gestionar plan y suscripción"
                              >
                                Plan
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className={styles.noDataMessage}>
                        {schools.length === 0
                          ? (isSuperAdmin
                            ? 'No hay escuelas registradas en la plataforma.'
                            : 'No tienes escuelas asignadas. Contacta a un administrador.')
                          : 'No se encontraron escuelas con los filtros aplicados.'}
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
