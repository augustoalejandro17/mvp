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

  const menuItems = [
    { href: '/', label: 'Inicio' },
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/users', label: 'Usuarios' },
    { href: '/admin/schools', label: 'Escuelas' },
    { href: '/admin/courses', label: 'Cursos' },
    { href: '/admin/subscriptions', label: 'Suscripciones' },
    { href: '/admin/reports', label: 'Reportes' },
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