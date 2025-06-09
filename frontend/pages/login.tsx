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
      // Set cookie to expire in 8 hours (0.33 days)
      Cookies.set('token', token, { expires: 0.33 });
      
      window.location.href = '/';
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
              style={{ 
                width: '100%', 
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: '#333',
                fontSize: '1rem'
              }}
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
              style={{ 
                width: '100%', 
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                backgroundColor: 'white',
                color: '#333',
                fontSize: '1rem'
              }}
            />
          </div>
          <button 
            type="submit" 
            className={styles.button}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginTop: '1.5rem'
            }}
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