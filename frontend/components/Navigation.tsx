import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getCookie } from 'cookies-next';
import jwt from 'jsonwebtoken';
import styles from '../styles/Navigation.module.css';

interface DecodedToken {
  id: number;
  role: string;
  schoolId?: number;
  exp: number;
}

const Navigation: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const token = getCookie('token');
    if (token) {
      try {
        const decoded = jwt.decode(token as string) as DecodedToken;
        setIsAuthenticated(true);
        setUserRole(decoded.role);
        setSchoolId(decoded.schoolId || null);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  const handleLogout = useCallback(() => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setIsAuthenticated(false);
    setUserRole(null);
    setSchoolId(null);
    setIsDropdownOpen(false);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu when route changes
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

  const isActive = (path: string) => {
    return router.pathname === path ? styles.active : '';
  };

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
                {userRole === 'TEACHER' && (
                  <Link href="/courses/my-courses" className={`${styles.navLink} ${isActive('/courses/my-courses')}`}>
                    Mis Cursos
                  </Link>
                )}
                {userRole === 'ADMIN' && (
                  <>
                    <Link href="/admin/dashboard" className={`${styles.navLink} ${isActive('/admin/dashboard')}`}>
                      Dashboard
                    </Link>
                    <Link href="/admin/payment-management" className={`${styles.navLink} ${isActive('/admin/payment-management')}`}>
                      Pagos
                    </Link>
                  </>
                )}
                <div className={`${styles.dropdown} ${isDropdownOpen ? styles.open : ''}`} ref={dropdownRef}>
                  <button
                    className={styles.dropdownButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(!isDropdownOpen);
                    }}
                    aria-expanded={isDropdownOpen}
                  >
                    Mi Cuenta
                  </button>
                  <div className={styles.dropdownContent}>
                    <Link href="/profile" className={styles.dropdownItem}>
                      Perfil
                    </Link>
                    <button onClick={handleLogout} className={styles.dropdownItem}>
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
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