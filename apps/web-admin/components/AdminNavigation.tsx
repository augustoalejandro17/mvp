import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../styles/AdminDashboard.module.css';

interface AdminNavigationProps {
  userRole?: string;
}

export default function AdminNavigation({ userRole }: AdminNavigationProps) {
  const router = useRouter();
  const currentPath = router.pathname;
  const normalizedRole = String(userRole || '').toLowerCase();

  const isActive = (path: string) => currentPath === path;

  // Check user roles
  const isSuperAdmin = normalizedRole.includes('super_admin');
  const isSchoolOwner = normalizedRole.includes('school_owner');
  const isAdministrative = normalizedRole.includes('administrative');
  const isAdmin =
    normalizedRole === 'admin' ||
    normalizedRole.split(/[\s,]+/).includes('admin');

  const baseMenuItems = [
    { href: '/', label: 'Inicio' },
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/users', label: 'Usuarios' },
    { href: '/admin/seats', label: 'Cupos' },
    { href: '/admin/categories', label: 'Categorías' },
    { href: '/admin/bulk-upload', label: 'Carga Masiva' },
    { href: '/admin/courses', label: 'Cursos' },
  ];

  // Items for super_admin, school_owner, and administrative
  const schoolManagementItems = [
    { href: '/admin/schools', label: 'Escuelas' },
  ];

  const superAdminItems = [
    { href: '/admin/subscriptions', label: 'Suscripciones' },
  ];

  const platformItems = [{ href: '/admin/platform', label: 'Plataforma' }];

  // Usage tracking and analytics available for all admin roles
  const usageTrackingItems = [
    { href: '/admin/usage', label: 'Uso de Recursos' },
    { href: '/admin/analytics', label: 'Analíticas' },
    { href: '/admin/insights', label: 'Insights' },
  ];

  const commonEndItems = [
    { href: '/admin/reports', label: 'Reportes' },
  ];

  // Build menu items based on role
  const menuItems = [
    ...baseMenuItems,
    ...(isSuperAdmin || isSchoolOwner || isAdministrative ? schoolManagementItems : []),
    ...(isSuperAdmin ? superAdminItems : []),
    ...(isSuperAdmin || isAdmin ? platformItems : []),
    ...usageTrackingItems,
    ...commonEndItems
  ];

  return (
    <div className={styles.sidebar}>
      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <Link 
            key={item.href}
            href={item.href} 
            className={`${styles.navLink} ${isActive(item.href) ? styles.navActive : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
} 
