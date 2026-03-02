import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../../styles/Breadcrumbs.module.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
  separator?: 'chevron' | 'slash' | 'arrow';
  className?: string;
}

const separators = {
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  slash: <span>/</span>,
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  ),
};

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

// Auto-generate breadcrumbs from URL
const generateBreadcrumbsFromPath = (pathname: string): BreadcrumbItem[] => {
  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  
  // Map common route segments to labels
  const labelMap: Record<string, string> = {
    'admin': 'Admin',
    'dashboard': 'Dashboard',
    'course': 'Curso',
    'courses': 'Cursos',
    'class': 'Clase',
    'classes': 'Clases',
    'school': 'Escuela',
    'schools': 'Escuelas',
    'profile': 'Perfil',
    'edit': 'Editar',
    'create': 'Crear',
    'attendance': 'Asistencia',
    'stats': 'Estadísticas',
    'schedule': 'Horario',
    'users': 'Usuarios',
    'subscriptions': 'Suscripciones',
    'reports': 'Reportes',
    'analytics': 'Analítica',
    'notifications': 'Notificaciones',
    'settings': 'Configuración',
    'community': 'Comunidad',
    'teacher': 'Profesor',
  };

  let currentPath = '';
  paths.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Skip dynamic segments like [id]
    if (segment.startsWith('[') && segment.endsWith(']')) {
      return;
    }
    
    // Check if it's a dynamic ID (UUID or numeric)
    const isDynamicId = /^[0-9a-f]{24}$|^[0-9]+$|^[0-9a-f-]{36}$/i.test(segment);
    
    if (!isDynamicId) {
      const label = labelMap[segment.toLowerCase()] || 
        segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      
      breadcrumbs.push({
        label,
        href: index < paths.length - 1 ? currentPath : undefined,
      });
    }
  });
  
  return breadcrumbs;
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
  separator = 'chevron',
  className = '',
}) => {
  const router = useRouter();
  
  // Use provided items or auto-generate from path
  const breadcrumbItems = items || generateBreadcrumbsFromPath(router.pathname);
  
  // Don't show if we're on home page or only have home
  if (router.pathname === '/' || breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Navegación de migas de pan" className={`${styles.container} ${className}`}>
      <ol className={styles.list}>
        {showHome && (
          <li className={styles.item}>
            <Link href="/" className={styles.link} aria-label="Inicio">
              <span className={styles.icon}>
                <HomeIcon />
              </span>
              <span className={styles.label}>Inicio</span>
            </Link>
            {breadcrumbItems.length > 0 && (
              <span className={styles.separator} aria-hidden="true">
                {separators[separator]}
              </span>
            )}
          </li>
        )}
        
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          
          return (
            <li key={`${item.label}-${index}`} className={styles.item}>
              {item.href && !isLast ? (
                <Link href={item.href} className={styles.link}>
                  {item.icon && <span className={styles.icon}>{item.icon}</span>}
                  <span className={styles.label}>{item.label}</span>
                </Link>
              ) : (
                <span className={`${styles.current} ${isLast ? styles.last : ''}`} aria-current={isLast ? 'page' : undefined}>
                  {item.icon && <span className={styles.icon}>{item.icon}</span>}
                  <span className={styles.label}>{item.label}</span>
                </span>
              )}
              
              {!isLast && (
                <span className={styles.separator} aria-hidden="true">
                  {separators[separator]}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;


