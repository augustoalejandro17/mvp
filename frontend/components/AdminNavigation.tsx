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

  const isActive = (path: string) => currentPath === path;

  // Check user roles
  const isSuperAdmin = userRole?.toLowerCase().includes('super_admin');
  const isSchoolOwner = userRole?.toLowerCase().includes('school_owner');

  const baseMenuItems = [
    { href: '/', label: 'Inicio' },
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/users', label: 'Usuarios' },
    { href: '/admin/bulk-upload', label: 'Carga Masiva' },
    { href: '/admin/courses', label: 'Cursos' },
  ];

  // Items only for super_admin and school_owner
  const schoolManagementItems = [
    { href: '/admin/schools', label: 'Escuelas' },
  ];

  const superAdminItems = [
    { href: '/admin/subscriptions', label: 'Suscripciones' },
  ];

  const commonEndItems = [
    { href: '/admin/reports', label: 'Reportes' },
  ];

  // Build menu items based on role
  const menuItems = [
    ...baseMenuItems,
    ...(isSuperAdmin || isSchoolOwner ? schoolManagementItems : []),
    ...(isSuperAdmin ? superAdminItems : []),
    ...commonEndItems
  ];

  return (
    <div className={styles.sidebar}>
      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <Link 
            key={item.href}
            href={item.href} 
            className={`${styles.navLink} ${isActive(item.href) ? styles.active : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
} 