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
          setUser({
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            role: 'super_admin', // Force role for debugging
          });
          setLoading(false);
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
        setUser({
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          role: primaryRole,
        });
        
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
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>Usuarios</h3>
              <p className={styles.statValue}>-</p>
            </div>
            <div className={styles.statCard}>
              <h3>Escuelas</h3>
              <p className={styles.statValue}>-</p>
            </div>
            <div className={styles.statCard}>
              <h3>Cursos</h3>
              <p className={styles.statValue}>-</p>
            </div>
            <div className={styles.statCard}>
              <h3>Clases</h3>
              <p className={styles.statValue}>-</p>
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