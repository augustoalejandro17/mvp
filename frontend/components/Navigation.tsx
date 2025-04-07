import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../styles/Navigation.module.css';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

interface User {
  name?: string;
  email?: string;
  role?: string;
}

const Navigation = () => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = Cookies.get('token');
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        setIsAuthenticated(true);
        setUserRole(decoded.role);
        setUserName(decoded.name);
        setUser({
          name: decoded.name,
          email: decoded.email,
          role: decoded.role
        });
      } catch (error) {
        console.error('Error decodificando token:', error);
      }
    } else {
      setIsAuthenticated(false);
      setUserRole('');
      setUserName('');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Cerrar el dropdown cuando se cambia de página
    const handleRouteChange = () => {
      setActiveDropdown(null);
      setIsMenuOpen(false);
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  // Cerrar dropdowns cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(`.${styles.dropdown}`)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    Cookies.remove('token');
    setIsAuthenticated(false);
    setUserRole('');
    setUserName('');
    setUser(null);
    router.push('/login');
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleDropdown = (dropdownName: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
  };

  return (
    <nav className={styles.navigation}>
      <div className={styles.navContainer}>
        <Link href="/">
          <a className={styles.logo}>DancePlatform</a>
        </Link>

        <div className={styles.mobileMenuButton} onClick={toggleMenu}>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div className={`${styles.navLinks} ${isMenuOpen ? styles.active : ''}`}>
          {/* Enlaces públicos */}
          <Link href="/">
            <a className={router.pathname === '/' ? styles.active : ''}>Inicio</a>
          </Link>

          {isAuthenticated ? (
            <>
              {/* Enlaces comunes para usuarios autenticados */}
              <Link href="/dashboard">
                <a className={router.pathname === '/dashboard' ? styles.active : ''}>Dashboard</a>
              </Link>

              {/* Enlaces específicos por rol */}
              {userRole === 'admin' && (
                <div className={`${styles.dropdown} ${activeDropdown === 'admin' ? styles.open : ''}`}>
                  <button 
                    className={styles.dropbtn}
                    onClick={toggleDropdown('admin')}
                  >
                    Administración 
                    <i className={styles.arrowDown}></i>
                  </button>
                  <div className={styles.dropdownContent}>
                    <Link href="/school/list">
                      <a>Gestionar Escuelas</a>
                    </Link>
                    <Link href="/users/list">
                      <a>Gestionar Usuarios</a>
                    </Link>
                    <Link href="/school/create">
                      <a>Crear Escuela</a>
                    </Link>
                  </div>
                </div>
              )}

              {(userRole === 'admin' || userRole === 'teacher') && (
                <div className={`${styles.dropdown} ${activeDropdown === 'teaching' ? styles.open : ''}`}>
                  <button 
                    className={styles.dropbtn}
                    onClick={toggleDropdown('teaching')}
                  >
                    Enseñanza 
                    <i className={styles.arrowDown}></i>
                  </button>
                  <div className={styles.dropdownContent}>
                    <Link href="/course/list">
                      <a>Mis Cursos</a>
                    </Link>
                    <Link href="/course/create">
                      <a>Crear Curso</a>
                    </Link>
                    <Link href="/class/create">
                      <a>Crear Clase</a>
                    </Link>
                  </div>
                </div>
              )}

              {/* Perfil y cerrar sesión */}
              <div className={`${styles.dropdown} ${activeDropdown === 'profile' ? styles.open : ''}`}>
                <button 
                  className={styles.dropbtn}
                  onClick={toggleDropdown('profile')}
                >
                  {userName} 
                  <i className={styles.arrowDown}></i>
                </button>
                <div className={styles.dropdownContent}>
                  <Link href="/profile">
                    <a>Mi Perfil</a>
                  </Link>
                  <a href="#" onClick={handleLogout}>Cerrar Sesión</a>
                </div>
              </div>

              {(user?.role === 'admin' || user?.role === 'teacher') && (
                <li className={styles.navItem}>
                  <Link href="/admin" className={router.pathname.startsWith('/admin') ? styles.active : ''}>
                    Panel de Administración
                  </Link>
                </li>
              )}
            </>
          ) : (
            <>
              {/* Enlaces para usuarios no autenticados */}
              <Link href="/login">
                <a className={router.pathname === '/login' ? styles.active : ''}>Iniciar Sesión</a>
              </Link>
              <Link href="/register">
                <a className={router.pathname === '/register' ? styles.active : ''}>Registrarse</a>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation; 