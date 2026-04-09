import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/AdminDashboard.module.css';
import AdminNavigation from '../../components/AdminNavigation';
import Link from 'next/link';

interface DecodedToken {
  sub?: string;   // For JWT token payload
  id?: string;    // For frontend user object  
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

interface FunnelSummary {
  steps: {
    authLoginSuccess: number;
    onboardingStarted: number;
    onboardingCompleted: number;
  };
  conversion: {
    loginToOnboardingStartPct: number;
    onboardingStartToCompletedPct: number;
  };
}

interface AuditLogItem {
  _id: string;
  action: string;
  actorEmail?: string;
  actorId: string;
  targetType: string;
  targetId?: string;
  createdAt: string;
}

interface SeatPolicyCapabilities {
  canViewSeatManagementModule: boolean;
  canOpenEnrollFlow: boolean;
  canAssignCourseSeatPermit: boolean;
  canSetOwnerQuota: boolean;
  canReadOwnerQuota: boolean;
  canSetOwnerQuotaForTarget: boolean;
  canReadOwnerQuotaForTarget: boolean;
  canEnrollStudentInCourse: boolean;
  canUnenrollStudentFromCourse: boolean;
  canAddStudentToCourse: boolean;
  canRemoveStudentFromCourse: boolean;
}

const DEFAULT_SEAT_CAPABILITIES: SeatPolicyCapabilities = {
  canViewSeatManagementModule: false,
  canOpenEnrollFlow: false,
  canAssignCourseSeatPermit: false,
  canSetOwnerQuota: false,
  canReadOwnerQuota: false,
  canSetOwnerQuotaForTarget: false,
  canReadOwnerQuotaForTarget: false,
  canEnrollStudentInCourse: false,
  canUnenrollStudentFromCourse: false,
  canAddStudentToCourse: false,
  canRemoveStudentFromCourse: false,
};

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
  const [funnelSummary, setFunnelSummary] = useState<FunnelSummary | null>(null);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsForbidden, setInsightsForbidden] = useState(false);
  const [seatCapabilities, setSeatCapabilities] = useState<SeatPolicyCapabilities>(
    DEFAULT_SEAT_CAPABILITIES,
  );

  // Fetch user schools based on role
  const fetchUserSchools = async (userId: string, userRole: string) => {
    try {
      // Get the JWT token from cookies
      const token = Cookies.get('token');
      if (!token) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // Determine which endpoint to use based on role
      // NOTE: We must include /api/ prefix for Next.js to route correctly to the backend
      let endpointUrl = '';
      if (userRole.toLowerCase().includes('super_admin')) {
        endpointUrl = `${apiUrl}/api/schools`; // The actual backend endpoint will be 'api/schools'
      } else if (userRole.toLowerCase().includes('school_owner')) {
        endpointUrl = `${apiUrl}/api/users/${userId}/owned-schools`; 
      } else if (userRole.toLowerCase().includes('administrative')) {
        endpointUrl = `${apiUrl}/api/users/${userId}/administered-schools`;
      } else {
        return; // Other roles don't have school access
      }

      

      // Fetch schools from the API
      const response = await fetch(endpointUrl, {
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

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      // Usar la ruta correcta de la API con la URL base
      let endpoint = `${apiUrl}/api/admin/stats`;
      if (schoolId !== 'all') {
        endpoint = `${apiUrl}/api/admin/stats?schoolId=${schoolId}`;
      }
      
      console.log('Fetching stats from:', endpoint);
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Error response from stats API:', response.status, response.statusText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Check if the response is valid JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Invalid content type:', contentType);
        throw new Error('Invalid response format');
      }

      const statsData = await response.json();
      
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
    
    setSelectedSchool(schoolId);
    fetchStats(schoolId);
  };

  // Function to refresh stats manually
  const refreshStats = () => {
    
    fetchStats(selectedSchool);
    fetchInsights();
    void fetchSeatPolicy(selectedSchool);
  };

  const fetchSeatPolicy = useCallback(async (schoolId: string = 'all') => {
    try {
      const token = Cookies.get('token');
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const params = new URLSearchParams();
      if (schoolId && schoolId !== 'all') {
        params.set('schoolId', schoolId);
      }

      const endpoint = `${apiUrl}/api/courses/seats/policy${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        setSeatCapabilities(DEFAULT_SEAT_CAPABILITIES);
        return;
      }

      const policy = await response.json();
      setSeatCapabilities(policy?.capabilities || DEFAULT_SEAT_CAPABILITIES);
    } catch {
      setSeatCapabilities(DEFAULT_SEAT_CAPABILITIES);
    }
  }, []);

  const fetchInsights = async () => {
    try {
      setLoadingInsights(true);
      setInsightsError(null);
      setInsightsForbidden(false);
      const token = Cookies.get('token');
      if (!token) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      const [funnelResponse, auditResponse] = await Promise.all([
        fetch(`${apiUrl}/api/product-analytics/funnel?days=30`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }),
        fetch(`${apiUrl}/api/audit-logs?page=1&limit=5`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }),
      ]);

      if (funnelResponse.status === 403 || auditResponse.status === 403) {
        setInsightsForbidden(true);
        setFunnelSummary(null);
        setRecentAuditLogs([]);
        return;
      }

      if (funnelResponse.ok) {
        const funnelData = await funnelResponse.json();
        setFunnelSummary(funnelData);
      } else {
        setFunnelSummary(null);
      }

      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        setRecentAuditLogs(auditData.items || []);
      } else {
        setRecentAuditLogs([]);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
      setInsightsError('No se pudieron cargar los insights rápidos.');
      setInsightsForbidden(false);
      setFunnelSummary(null);
      setRecentAuditLogs([]);
    } finally {
      setLoadingInsights(false);
    }
  };

  // Corregir la función testApiConnectivity para usar el nuevo endpoint overview
  const testApiConnectivity = async () => {
    try {
      console.log('Testing API connectivity...');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Probar el endpoint de overview
      console.log('Testing overview endpoint...');
      
      const response = await fetch(`${apiUrl}/api/admin/stats/overview`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API connectivity test successful:', data);
      } else {
        console.error('❌ API connectivity test failed:', response.status, response.statusText);
        // Si hay error, intentamos con el endpoint de salud
        console.log('Trying health endpoint as fallback...');
        const healthResponse = await fetch(`${apiUrl}/api/health`, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (healthResponse.ok) {
          console.log('✅ Health endpoint is working');
        } else {
          console.error('❌ Health endpoint also failed');
        }
      }
    } catch (error) {
      console.error("Error testing API connectivity:", error);
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
        router.push('/');
        return;
      }

      try {
        const decoded = jwtDecode<DecodedToken>(token);
        
        // Restaurar temporalmente acceso especial para Augusto durante la depuración
        if (decoded.email && decoded.email.toLowerCase().includes('augusto')) {
          
                  const userId = decoded.id || decoded.sub;
        if (!userId) {
          console.error('No user ID found in token');
          router.push('/login');
          return;
        }
        
        const userInfo = {
          id: userId,
          email: decoded.email,
          name: decoded.name,
          role: 'super_admin', // Force role for debugging
        };
        setUser(userInfo);
        setLoading(false);
        
        // Fetch schools for this user
          fetchUserSchools(userId, 'super_admin');
          // Fetch stats for all schools by default
          fetchStats('all');
          fetchInsights();
          void fetchSeatPolicy('all');
          return;
        }
        
        // Determine primary role using precedence
        let primaryRole: string;
        
        if (Array.isArray(decoded.role)) {
          
          
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
              
              break;
            }
          }
          
          primaryRole = foundRole || decoded.role[0]; // Use the highest precedence or default to first
        } else {
          primaryRole = decoded.role;
        }
        
        
        
        // Check if role has admin access
        const normalizedRole = String(primaryRole).toLowerCase();
        const hasAdminAccess = ADMIN_ROLES.some(role => normalizedRole.includes(role.toLowerCase()));
        
        
        
        if (!hasAdminAccess) {
          
          router.push('/');
          return;
        }

        const userId = decoded.id || decoded.sub;
        if (!userId) {
          console.error('No user ID found in token');
          router.push('/login');
          return;
        }
        
        const userInfo = {
          id: userId,
          email: decoded.email,
          name: decoded.name,
          role: primaryRole,
        };
        setUser(userInfo);
        
        // Fetch schools for this user
        fetchUserSchools(userId, primaryRole);
        // Fetch stats for all schools by default
        fetchStats('all');
        fetchInsights();
        void fetchSeatPolicy('all');
        
        setLoading(false);
      } catch (error) {
        console.error('Error al decodificar token:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router, fetchSeatPolicy]);

  if (loading) {
    return <div className={styles.loading}>Cargando panel de administración...</div>;
  }

  const normalizedRole = String(user?.role || '').toLowerCase();
  const canViewInsights =
    normalizedRole === 'super_admin' ||
    normalizedRole === 'admin' ||
    normalizedRole.includes('super_admin');

  return (
    <div className={styles.container}>
      <div className={styles.dashboardHeader}>
        <h1>Panel de Administración</h1>
        <p>Bienvenido/a, {user?.name}. Desde aquí podrás gestionar todos los aspectos de tu cuenta.</p>
      </div>

      <div className={styles.content}>
        <AdminNavigation userRole={user?.role} />

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

            {user?.role?.toLowerCase().includes('super_admin') && (
              <div className={styles.statCard}>
                <h3>Escuelas</h3>
                <p className={styles.statValue}>
                  {loadingStats ? <span className={styles.loadingDots}>...</span> : stats.schools}
                </p>
              </div>
            )}
          </div>

          {canViewInsights && !insightsForbidden && (
            <div className={styles.insightsSection}>
              <div className={styles.insightsHeader}>
                <h3>Insights rápidos (30 días)</h3>
                <Link href="/admin/insights" className={styles.insightsLink}>
                  Ver detalle
                </Link>
              </div>

              {insightsError && <p className={styles.errorText}>{insightsError}</p>}

              <div className={styles.insightGrid}>
                <div className={styles.insightCard}>
                  <span className={styles.insightLabel}>Logins</span>
                  <strong className={styles.insightValue}>
                    {loadingInsights ? '...' : funnelSummary?.steps?.authLoginSuccess ?? '-'}
                  </strong>
                </div>
                <div className={styles.insightCard}>
                  <span className={styles.insightLabel}>Onboarding iniciado</span>
                  <strong className={styles.insightValue}>
                    {loadingInsights ? '...' : funnelSummary?.steps?.onboardingStarted ?? '-'}
                  </strong>
                </div>
                <div className={styles.insightCard}>
                  <span className={styles.insightLabel}>Onboarding completado</span>
                  <strong className={styles.insightValue}>
                    {loadingInsights ? '...' : funnelSummary?.steps?.onboardingCompleted ?? '-'}
                  </strong>
                </div>
                <div className={styles.insightCard}>
                  <span className={styles.insightLabel}>Login → Inicio</span>
                  <strong className={styles.insightValue}>
                    {loadingInsights
                      ? '...'
                      : `${funnelSummary?.conversion?.loginToOnboardingStartPct ?? '-'}%`}
                  </strong>
                </div>
                <div className={styles.insightCard}>
                  <span className={styles.insightLabel}>Inicio → Completado</span>
                  <strong className={styles.insightValue}>
                    {loadingInsights
                      ? '...'
                      : `${funnelSummary?.conversion?.onboardingStartToCompletedPct ?? '-'}%`}
                  </strong>
                </div>
              </div>

              <div className={styles.auditPreview}>
                <h4>Últimos eventos de auditoría</h4>
                {loadingInsights ? (
                  <p>Cargando auditoría...</p>
                ) : recentAuditLogs.length > 0 ? (
                  <ul className={styles.auditList}>
                    {recentAuditLogs.map((log) => (
                      <li key={log._id} className={styles.auditItem}>
                        <span className={styles.auditDate}>
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                        <span className={styles.auditAction}>{log.action}</span>
                        <span className={styles.auditActor}>
                          {log.actorEmail || log.actorId}
                        </span>
                        <span className={styles.auditTarget}>
                          {log.targetType}
                          {log.targetId ? `:${log.targetId}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Sin eventos recientes o sin permisos para auditoría.</p>
                )}
              </div>
            </div>
          )}

          {!canViewInsights && (
            <div className={styles.insightsNotice}>
              Insights disponibles solo para administradores globales.
            </div>
          )}

          {canViewInsights && insightsForbidden && (
            <div className={styles.insightsNotice}>
              No tienes permisos para ver insights en este entorno.
            </div>
          )}

          <div className={styles.quickActions}>
            <h3>Acciones Rápidas</h3>
            <div className={styles.actionsGrid}>
              <Link href="/admin/schools/create" className={styles.actionButton}>
                <div className={styles.actionIconWrapper}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <span>Crear Escuela</span>
              </Link>
              <Link href="/admin/courses/create" className={styles.actionButton}>
                <div className={styles.actionIconWrapper}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <span>Crear Curso</span>
              </Link>
              <Link href="/admin/classes/create" className={styles.actionButton}>
                <div className={styles.actionIconWrapper}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <span>Crear Clase</span>
              </Link>
              <Link href="/admin/users" className={styles.actionButton}>
                <div className={styles.actionIconWrapper}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <span>Ver Usuarios</span>
              </Link>
              {seatCapabilities.canOpenEnrollFlow && (
                <Link href="/admin/enrollment-management" className={styles.actionButton}>
                  <div className={styles.actionIconWrapper}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="17" y1="11" x2="23" y2="11"></line>
                    </svg>
                  </div>
                  <span>Gestionar Matrículas</span>
                </Link>
              )}
              {seatCapabilities.canViewSeatManagementModule && (
                <Link href="/admin/seats" className={styles.actionButton}>
                  <div className={styles.actionIconWrapper}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20"></path>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                  </div>
                  <span>Gestión de Cupos</span>
                </Link>
              )}
              {(normalizedRole === 'super_admin' || normalizedRole === 'admin') && (
                <Link href="/admin/platform" className={styles.actionButton}>
                  <div className={styles.actionIconWrapper}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                      <path d="M9 9h6v6H9z"></path>
                      <path d="M9 1v2"></path>
                      <path d="M15 1v2"></path>
                      <path d="M9 21v2"></path>
                      <path d="M15 21v2"></path>
                      <path d="M21 9h2"></path>
                      <path d="M21 14h2"></path>
                      <path d="M1 9h2"></path>
                      <path d="M1 14h2"></path>
                    </svg>
                  </div>
                  <span>Control de Plataforma</span>
                </Link>
              )}
              {user?.role?.toLowerCase().includes('super_admin') && (
                <Link href="/admin/subscriptions" className={styles.actionButton}>
                  <div className={styles.actionIconWrapper}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                      <path d="M8 14h.01"></path>
                      <path d="M12 14h.01"></path>
                      <path d="M16 14h.01"></path>
                      <path d="M8 18h.01"></path>
                      <path d="M12 18h.01"></path>
                      <path d="M16 18h.01"></path>
                    </svg>
                  </div>
                  <span>Gestionar Suscripciones</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
