import React, { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Cookies from 'js-cookie';
import { refreshAuth } from '../../utils/auth';
import styles from '../../styles/Login.module.css';

interface LinkingData {
  email: string;
  idToken: string;
  provider: string;
}

const LinkAccountPage: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkingData, setLinkingData] = useState<LinkingData | null>(null);

  useEffect(() => {
    // Get linking data from URL parameters
    const { data } = router.query;
    
    if (data && typeof data === 'string') {
      try {
        const decodedData = JSON.parse(Buffer.from(decodeURIComponent(data), 'base64').toString());
        setLinkingData(decodedData);
        setEmail(decodedData.email);
      } catch (err) {
        console.error('Failed to decode linking data:', err);
        router.push('/login');
      }
    } else if (router.isReady) {
      // If no linking data, redirect to login
      router.push('/login');
    }
  }, [router]);

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // First, authenticate with the existing local account
      const loginResponse = await axios.post(`${apiUrl}/api/auth/login`, {
        email,
        password
      });

      const { token } = loginResponse.data;

                   // Now link the Google account using the token
      const linkResponse = await axios.post(
        `${apiUrl}/api/auth/google/link`,
        {
          idToken: linkingData?.idToken || '',
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Store the NEW token from linking response (includes updated user data)
      const newToken = linkResponse.data.token;
      Cookies.set('token', newToken, { expires: 7 });
      Cookies.set('user', JSON.stringify(linkResponse.data.user), { expires: 7 });

      // Trigger auth state update for the Navigation component
      refreshAuth();

      // Sign out from NextAuth (since we're now using backend auth)
      await signOut({ redirect: false });

      // Redirect to dashboard
      router.push('/dashboard');

    } catch (err: any) {
      console.error('Account linking failed:', err);
      if (err.response?.status === 401) {
        setError('Credenciales incorrectas. Verifica tu email y contraseña.');
      } else if (err.response?.status === 409) {
        setError('Esta cuenta de Google ya está vinculada a otro usuario.');
      } else {
        setError('Error al vincular la cuenta. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Sign out from NextAuth and redirect to login
    await signOut({ redirect: false });
    router.push('/login');
  };

  if (!linkingData) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Cargando...</h1>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Vincular Cuenta</h1>
        
        <div className={styles.form}>
          <div className={styles.infoBox}>
            <h3>💡 Cuenta existente encontrada</h3>
            <p>
              Ya tienes una cuenta con el email <strong>{linkingData?.email}</strong>.
            </p>
            <p>
              Para vincular tu cuenta de Google, ingresa tu contraseña actual:
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleLinkAccount}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!linkingData?.email}
                className={styles.input}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password">Contraseña:</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
                placeholder="Ingresa tu contraseña actual"
              />
            </div>

            <button 
              type="submit" 
              className={styles.button}
              disabled={loading}
            >
              {loading ? 'Vinculando...' : 'Vincular Cuenta de Google'}
            </button>
          </form>

          <div className={styles.linkOptions}>
            <button 
              onClick={handleCancel}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancelar y volver al login
            </button>
            
            <p className={styles.helpText}>
              <Link href="/forgot-password">
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
          </div>
        </div>

        <div className={styles.benefits}>
          <h3>Beneficios de vincular tu cuenta:</h3>
          <ul>
            <li>✅ Acceso más rápido con Google</li>
            <li>✅ Mantén todos tus datos y progreso</li>
            <li>✅ Una sola cuenta para todo</li>
            <li>✅ Mayor seguridad</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default LinkAccountPage; 