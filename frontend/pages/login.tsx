import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import styles from '../styles/Login.module.css';
import Cookies from 'js-cookie';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await axios.post(
        `${apiUrl}/api/auth/login`, 
        { email, password },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      const { token } = response.data;
      Cookies.set('token', token, { expires: 7 });
      
      router.push('/');
    } catch (error: any) {
      console.error('Error de inicio de sesión:', error);
      
      if (error.response && error.response.data && error.response.data.message) {
        setError(error.response.data.message);
      } else {
        setError('Error al iniciar sesión. Por favor, verifica tus credenciales e intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Iniciar Sesión</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
              minLength={6}
            />
          </div>
          <button 
            type="submit" 
            className={styles.button}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Iniciar Sesión'}
          </button>
        </form>
        <p className={styles.registerLink}>
          ¿No tienes cuenta? <Link href="/register">Regístrate</Link>
        </p>
      </main>
    </div>
  );
} 