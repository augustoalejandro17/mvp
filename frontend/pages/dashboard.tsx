import { useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redireccionar a la página principal
    router.push('/');
  }, [router]);

  return (
    <div className={styles.loading}>Redireccionando...</div>
  );
} 