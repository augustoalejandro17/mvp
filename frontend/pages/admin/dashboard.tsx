import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/AdminDashboard.module.css';
import Link from 'next/link';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string | string[];
}

interface School {
  _id: string;
  name: string;
  address?: string;
  logo?: string;
}

// Define role precedence - highest priority first
const ROLE_PRECEDENCE = [
  'super_admin', 
  'SUPER_ADMIN', 
  'superadmin', 
  'SUPERADMIN',
  'school_owner', 
  'SCHOOL_OWNER',
  'administrative', 
  'ADMINISTRATIVE',
  'admin',
  'ADMIN',
  'teacher',
  'TEACHER',
  'student',
  'STUDENT'
];

// Define roles that have admin access
const ADMIN_ROLES = [
  'super_admin', 
  'superadmin',
  'school_owner',
  'administrative',
  'admin'
];

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{id: string; email: string; name: string; role: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [userSchools, setUserSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [stats, setStats] = useState({
    users: '-',
    schools: '-',
    courses: '-',
    classes: '-'
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Fetch user schools based on role
  const fetchUserSchools = async (userId: string, userRole: string) => {
    try {
      // Get the JWT token from cookies
      const token = Cookies.get('token');
      if (!token) return;

      // Determine which endpoint to use based on role
      // NOTE: We must include /api/ prefix for Next.js to route correctly to the backend
      let endpoint = '';
      if (userRole.toLowerCase().includes('super_admin')) {
        endpoint = '/api/schools'; // The actual backend endpoint will be 'api/schools'
      } else if (userRole.toLowerCase().includes('school_owner')) {
        endpoint = `/api/users/${userId}/owned-schools`; 
      } else if (userRole.toLowerCase().includes('administrative')) {
        endpoint = `/api/users/${userId}/administered-schools`;
      } else {
        return; // Other roles don't have school access
      }

      console.log(`Fetching schools from endpoint: ${endpoint}`);

      // Fetch schools from the API
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Error fetching schools:', response.status, response.statusText);
        throw new Error('Failed to fetch schools');
      }

      const schoolsData = await response.json();
      
      // Add "All Schools" option for super_admin
      if (userRole.toLowerCase().includes('super_admin')) {
        setSchools(schoolsData);
      }
      
      setUserSchools(schoolsData);
      console.log('Schools loaded:', schoolsData);
    } catch (error) {
      console.error('Error fetching schools:', error);
    }
  };

  // Fetch statistics based on selected school
  const fetchStats = async (schoolId: string = 'all') => {
    try {
      setLoadingStats(true);
      setStatsError(null);
      const token = Cookies.get('token');
      if (!token) return;

      // NOTE: The Next.js config rewrites /api/* to the backend at http://localhost:4000/api/*
      // So we need to use /api/ here which gets sent to the right endpoint
      let endpoint = '/api/admin/stats';
      if (schoolId !== 'all') {
        endpoint = `/api/admin/stats?schoolId=${schoolId}`;
      }

      // Get the full URL to help with debugging
      const baseUrl = window.location.origin;
      const fullUrl = `${baseUrl}${endpoint}`;
      console.log(`Full URL being requested: ${fullUrl}`);
      console.log(`Fetching stats from endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Stats API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from stats API:', response.status, response.statusText);
        console.error('Error response body:', errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const statsData = await response.json();
      console.log('Received stats data:', statsData);
      
      if (statsData.error) {
        throw new Error(statsData.error);
      }
      
      // Para evitar errores, asegurarnos de que todas las propiedades existen
      setStats({
        users: typeof statsData.users === 'number' ? statsData.users.toString() : '-',
        schools: typeof statsData.schools === 'number' ? statsData.schools.toString() : '-',
        courses: typeof statsData.courses === 'number' ? statsData.courses.toString() : '-',
        classes: typeof statsData.classes === 'number' ? statsData.classes.toString() : '-'
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      setStatsError(error instanceof Error ? error.message : 'Error al cargar estadísticas');
      // Set default values in case of error
      setStats({
        users: '-',
        schools: '-',
        courses: '-',
        classes: '-'
      });
    } finally {
      setLoadingStats(false);
    }
  };

  // Handle school selection change
  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schoolId = e.target.value;
    console.log(`School selection changed to: ${schoolId}`);
    setSelectedSchool(schoolId);
    fetchStats(schoolId);
  };

  // Function to refresh stats manually
  const refreshStats = () => {
    console.log(`Manually refreshing stats for school: ${selectedSchool}`);
    fetchStats(selectedSchool);
  };

  // Test API connectivity with different URL formats
  const testApiConnectivity = async () => {
    console.log("Testing API connectivity with different URL formats...");
    
    try {
      // Format 1: Direct /api path (Next.js rewrites this to backend)
      const response1 = await fetch('/api/admin/stats/public-test');
      const data1 = await response1.json();
      console.log("Format 1 result (/api/admin/stats/public-test):", data1);
    } catch (error) {
      console.error("Format 1 error:", error);
    }

    try {
      // Format 2: Using the direct-api path (tests without /api prefix)
      const response2 = await fetch('/direct-api/admin/stats/public-test');
      const data2 = await response2.json();
      console.log("Format 2 result (/direct-api/admin/stats/public-test):", data2);
    } catch (error) {
      console.error("Format 2 error:", error);
    }

    try {
      // Format 3: Root app controller test route
      const response3 = await fetch('/api/test-route');
      const data3 = await response3.json();
      console.log("Format 3 result (/api/test-route):", data3);
    } catch (error) {
      console.error("Format 3 error:", error);
    }
  };

  useEffect(() => {
    // Test API connectivity on load
    testApiConnectivity();
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login?redirect=/admin/dashboard');
        return;
      }

      try {
        const decoded = jwtDecode<DecodedToken>(token);
        console.log('Dashboard - Token decodificado:', decoded);
        
        // Restaurar temporalmente acceso especial para Augusto durante la depuración
        if (decoded.email && decoded.email.toLowerCase().includes('augusto')) {
          console.log('Dashboard - Augusto detectado, otorgando acceso especial');
          const userInfo = {
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            role: 'super_admin', // Force role for debugging
          };
          setUser(userInfo);
          setLoading(false);
          
          // Fetch schools for this user
          fetchUserSchools(decoded.sub, 'super_admin');
          // Fetch stats for all schools by default
          fetchStats('all');
          return;
        }
        
        // Determine primary role using precedence
        let primaryRole: string;
        
        if (Array.isArray(decoded.role)) {
          console.log('Dashboard - Múltiples roles detectados:', decoded.role);
          
          // Normalize roles to lowercase for comparison
          const normalizedRoles = decoded.role.map(role => String(role).toLowerCase());
          
          // Find the highest precedence role in the array
          const normalizedPrecedence = ROLE_PRECEDENCE.map(role => role.toLowerCase());
          
          // Find first matching role based on precedence order
          let foundRole = null;
          for (const precedenceRole of normalizedPrecedence) {
            const matchingRole = normalizedRoles.find(role => 
              role === precedenceRole || 
              role.includes(precedenceRole) || 
              precedenceRole.includes(role)
            );
            if (matchingRole) {
              // Use the original casing from the token
              foundRole = decoded.role[normalizedRoles.indexOf(matchingRole)];
              console.log(`Dashboard - Rol con mayor precedencia encontrado: ${foundRole}`);
              break;
            }
          }
          
          primaryRole = foundRole || decoded.role[0]; // Use the highest precedence or default to first
        } else {
          primaryRole = decoded.role;
        }
        
        console.log('Dashboard - Role prioritario:', primaryRole);
        
        // Check if role has admin access
        const normalizedRole = String(primaryRole).toLowerCase();
        const hasAdminAccess = ADMIN_ROLES.some(role => normalizedRole.includes(role.toLowerCase()));
        
        console.log('Dashboard - ¿Tiene acceso de administrador?', hasAdminAccess);
        
        if (!hasAdminAccess) {
          console.log('Dashboard - Access denied, redirecting to home');
          router.push('/');
          return;
        }

        console.log('Dashboard - Access granted');
        const userInfo = {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          role: primaryRole,
        };
        setUser(userInfo);
        
        // Fetch schools for this user
        fetchUserSchools(decoded.sub, primaryRole);
        // Fetch stats for all schools by default
        fetchStats('all');
        
        setLoading(false);
      } catch (error) {
        console.error('Error al decodificar token:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return <div className={styles.loading}>Cargando panel de administración...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Panel de Administración</h1>
        <p>Bienvenido/a, {user?.name}. Desde aquí podrás gestionar todos los aspectos de la plataforma educativa.</p>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <nav className={styles.nav}>
            <Link href="/" className={styles.navLink}>
              Inicio
            </Link>
            <Link href="/admin/dashboard" className={`${styles.navLink} ${styles.active}`}>
              Dashboard
            </Link>
            <Link href="/admin/users" className={styles.navLink}>
              Usuarios
            </Link>
            <Link href="/admin/schools" className={styles.navLink}>
              Escuelas
            </Link>
            <Link href="/admin/courses" className={styles.navLink}>
              Cursos
            </Link>
            <Link href="/admin/stats" className={styles.navLink}>
              Estadísticas
            </Link>
          </nav>
        </div>

        <div className={styles.mainContent}>
          {/* School selector */}
          <div className={styles.schoolSelector}>
            <label htmlFor="school-select">Escuela: </label>
            <select 
              id="school-select" 
              value={selectedSchool} 
              onChange={handleSchoolChange}
              className={styles.schoolSelect}
            >
              {/* All schools option for super admin */}
              {user?.role?.toLowerCase().includes('super_admin') && (
                <option value="all">Todas las escuelas</option>
              )}
              
              {/* User's schools */}
              {userSchools.map(school => (
                <option key={school._id} value={school._id}>
                  {school.name}
                </option>
              ))}
              
              {/* Show message if no schools available */}
              {userSchools.length === 0 && (
                <option disabled value="">No tienes escuelas asignadas</option>
              )}
            </select>
            <button 
              onClick={refreshStats} 
              className={styles.refreshButton}
              disabled={loadingStats}
            >
              {loadingStats ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>

          {/* Error message if stats failed to load */}
          {statsError && (
            <div className={styles.errorMessage}>
              <p>{statsError}</p>
              <button 
                onClick={refreshStats}
                className={styles.retryButton}
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Stats grid with loading indicator */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>Usuarios</h3>
              <p className={styles.statValue}>
                {loadingStats ? <span className={styles.loadingDots}>...</span> : stats.users}
              </p>
            </div>
            <div className={styles.statCard}>
              <h3>Cursos</h3>
              <p className={styles.statValue}>
                {loadingStats ? <span className={styles.loadingDots}>...</span> : stats.courses}
              </p>
            </div>
            <div className={styles.statCard}>
              <h3>Clases</h3>
              <p className={styles.statValue}>
                {loadingStats ? <span className={styles.loadingDots}>...</span> : stats.classes}
              </p>
            </div>
          </div>

          <div className={styles.quickActions}>
            <h3>Acciones Rápidas</h3>
            <div className={styles.actionsGrid}>
              <button className={styles.actionButton} onClick={() => router.push('/admin/users/create')}>
                Crear Usuario
              </button>
              <button className={styles.actionButton} onClick={() => router.push('/school/create')}>
                Crear Escuela
              </button>
              <button className={styles.actionButton} onClick={() => router.push('/admin/reports')}>
                Ver Reportes
              </button>
              <button className={styles.actionButton} onClick={() => router.push('/admin/settings')}>
                Configuración
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 