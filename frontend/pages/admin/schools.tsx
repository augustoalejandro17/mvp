import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import axios from 'axios';
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
  teachers: any[];
  students: any[];
  createdAt: string;
  timezone?: string;
}

export default function SchoolsManager() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login?redirect=/admin/schools');
        return;
      }

      try {
        const decoded: DecodedToken = jwtDecode(token);
        const role = decoded.role?.toLowerCase();
        
        // Only allow super_admin and school_owner
        if (!role.includes('super_admin') && !role.includes('school_owner')) {
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
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const role = user.role?.toLowerCase();

      let endpoint = '';
      if (role.includes('super_admin')) {
        // Super admin can see all schools
        endpoint = `${apiUrl}/api/schools`;
      } else if (role.includes('school_owner')) {
        // School owner can only see their owned schools
        endpoint = `${apiUrl}/api/users/${user.sub}/owned-schools`;
      }

      const response = await axios.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
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

  const isSuperAdmin = userRole?.toLowerCase().includes('super_admin');

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
          <div className={styles.actionsRow}>
            <div className={styles.statsContainer}>
              <span className={styles.statItem}>
                Total: {schools.length} escuela{schools.length !== 1 ? 's' : ''}
              </span>
            </div>
            <Link href="/school/create" className={styles.addButton}>
              Crear Nueva Escuela
            </Link>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Administrador</th>
                    <th>Estudiantes</th>
                    <th>Profesores</th>
                    <th>Zona Horaria</th>
                    <th>Fecha Creación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.length > 0 ? (
                    schools.map((school) => (
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
                              <span style={{ color: '#718096', fontStyle: 'italic' }}>
                                Sin asignar
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{school.students?.length || 0}</td>
                        <td style={{ textAlign: 'center' }}>{school.teachers?.length || 0}</td>
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
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className={styles.noDataMessage}>
                        {isSuperAdmin 
                          ? 'No hay escuelas registradas en la plataforma.'
                          : 'No tienes escuelas asignadas. Contacta a un administrador.'}
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