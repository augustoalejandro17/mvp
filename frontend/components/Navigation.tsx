import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getCookie } from 'cookies-next';
import { jwtDecode } from 'jwt-decode';
import styles from '../styles/Navigation.module.css';
import { getToken, subscribeToAuth, clearAuth, logout } from '../utils/auth';
import NotificationBell from './NotificationBell';

interface DecodedToken {
  sub: string;
  role: string | string[]; // Can be string or array of strings
  email: string;
  name: string;
  exp: number;
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

const Navigation: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const checkAuth = useCallback(() => {
    const token = getToken();
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        
        // Handle the case where the role is an array
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
        
        setIsAuthenticated(true);
        setUserRole(primaryRole);
        setUserEmail(decoded.email);
      } catch (error) {
        console.error('Error decoding token:', error);
        clearAuth();
      }
    } else {
      setIsAuthenticated(false);
      setUserRole(null);
      setUserEmail(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    // Suscribirse a cambios en la autenticación
    const unsubscribe = subscribeToAuth(checkAuth);
    return () => {
      unsubscribe();
    };
  }, [checkAuth]);

  const handleLogout = useCallback(async () => {
    setIsDropdownOpen(false); // Cerrar el dropdown primero
    
    try {
      // Use the new logout function that invalidates server session
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
      // Fallback to local logout if server logout fails
      clearAuth();
    }
    
    // Limpiar el estado local después de que logout haya terminado
    setIsAuthenticated(false);
    setUserRole(null);
    setUserEmail(null);
    
    // Redirigir después de limpiar todo
    router.push('/login');
  }, [router]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle route changes
  useEffect(() => {
    const handleRouteChange = () => {
      setIsMobileMenuOpen(false);
      setIsDropdownOpen(false);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  // Toggle dropdown menu
  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
    
    // If we're on mobile, don't close the mobile menu when opening the dropdown
    if (window.innerWidth <= 768) {
      setIsMobileMenuOpen(true);
    }
  };
  
  const isActive = (path: string) => {
    return router.pathname === path ? styles.active : '';
  };

  // Helper function to check admin roles
  const hasAdminAccess = () => {
    if (!userRole) {
      
      return false;
    }
    
    // Use lowercase for all comparisons
    const role = String(userRole).toLowerCase();
    
    
    // Restaurar temporalmente el acceso especial para Augusto durante la depuración
    if (userEmail && userEmail.toLowerCase().includes('augusto')) {
      
      return true;
    }
    
    // Check for admin roles - only super_admin, school_owner, and administrative have admin access
    const adminRoles = ['super_admin', 'superadmin', 'school_owner', 'administrative', 'admin'];
    const isAdmin = adminRoles.some(adminRole => {
      const matches = role.includes(adminRole);
      
      return matches;
    });
      
    
    
    return isAdmin;
  };

  // Handle navigation to admin dashboard
  const navigateToAdminDashboard = (e: React.MouseEvent) => {
    e.preventDefault();
    
    setIsDropdownOpen(false);
    
    
    // Use direct navigation without timeout
    router.push('/admin/dashboard');
  };

  // Debug effect to log authentication state
  useEffect(() => {
    
    
    
    
    
  }, [isAuthenticated, userRole, userEmail]);

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandName}>Inti</span>
        </Link>

        <div className={styles.navMenu}>
          <button
            className={`${styles.mobileMenuButton} ${isMobileMenuOpen ? styles.open : ''}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className={styles.mobileMenuIcon} />
          </button>

          <div className={`${styles.navLinks} ${isMobileMenuOpen ? styles.show : ''}`}>
            {isAuthenticated ? (
              <>
                <Link href="/" className={`${styles.navLink} ${isActive('/')}`}>
                  Inicio
                </Link>
                <Link href="/community?tab=courses" className={`${styles.navLink} ${isActive('/community')}`}>
                  Mis Cursos
                </Link>
                {userRole === 'TEACHER' && (
                  <Link href="/courses/my-courses" className={`${styles.navLink} ${isActive('/courses/my-courses')}`}>
                    Gestionar Cursos
                  </Link>
                )}
                {(userRole === 'admin' || userRole === 'ADMIN') && (
                  <>
                    <Link href="/admin/schools" className={`${styles.navLink} ${isActive('/admin/schools')}`}>
                      🏫 Escuelas
                    </Link>
                    <Link href="/admin/subscriptions/list" className={`${styles.navLink} ${isActive('/admin/subscriptions')}`}>
                      💳 Suscripciones
                    </Link>
                    <Link href="/admin/users" className={`${styles.navLink} ${isActive('/admin/users')}`}>
                      👥 Usuarios
                    </Link>
                    <Link href="/admin/bulk-upload" className={`${styles.navLink} ${isActive('/admin/bulk-upload')}`}>
                      📁 Carga Masiva
                    </Link>
                  </>
                )}
                <div className={`${styles.dropdown} ${isDropdownOpen ? styles.open : ''}`} ref={dropdownRef}>
                  <button
                    className={styles.dropdownButton}
                    onClick={toggleDropdown}
                    aria-expanded={isDropdownOpen}
                  >
                    Mi Cuenta
                    {/* Arrow icon is added via CSS */}
                  </button>
                  <div className={styles.dropdownContent}>
                    <Link href="/profile" className={styles.dropdownItem} onClick={() => setIsDropdownOpen(false)}>
                      Perfil
                    </Link>
                    {(() => {
                      // Debugging roles directly from the token
                      const hasAccess = hasAdminAccess();
                      
                      
                      return hasAccess ? (
                        <a 
                          href="/admin/dashboard"
                          className={styles.dropdownItem}
                          onClick={() => {
                            
                            setIsDropdownOpen(false);
                          }}
                        >
                          Panel de Control
                        </a>
                      ) : null;
                    })()}
                    <button onClick={handleLogout} className={styles.dropdownItem}>
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
                <NotificationBell />
              </>
            ) : (
              <>
                <Link href="/login" className={`${styles.navLink} ${isActive('/login')}`}>
                  Iniciar Sesión
                </Link>
                <Link href="/register" className={`${styles.navLink} ${isActive('/register')}`}>
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation; 