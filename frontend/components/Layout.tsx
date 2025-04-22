import React, { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import styles from '../styles/Layout.module.css';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export default function Layout({ 
  children, 
  title = 'Marketplace de Clases de Baile', 
  description = 'Plataforma para encontrar y reservar clases de baile'
}: LayoutProps) {
  const router = useRouter();

  const handleLogout = () => {
    Cookies.remove('token');
    router.push('/login');
  };

  const isLoggedIn = typeof window !== 'undefined' && Cookies.get('token');

  return (
    <div className={styles.container}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logo}>
          <Link href="/">Dance Marketplace</Link>
        </div>
        <nav className={styles.nav}>
          <ul className={styles.navList}>
            <li className={styles.navItem}>
              <Link href="/">Home</Link>
            </li>
            {isLoggedIn ? (
              <>
                <li className={styles.navItem}>
                  <button onClick={handleLogout} className={styles.logoutBtn}>
                    Cerrar Sesión
                  </button>
                </li>
              </>
            ) : (
              <>
                <li className={styles.navItem}>
                  <Link href="/login">Iniciar Sesión</Link>
                </li>
                <li className={styles.navItem}>
                  <Link href="/register">Registrarse</Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Dance Marketplace - Todos los derechos reservados</p>
      </footer>
    </div>
  );
} 