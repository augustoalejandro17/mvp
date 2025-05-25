import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import { jwtDecode } from 'jwt-decode';
import ImageFallback from '../components/ImageFallback';

interface School {
  _id: string;
  name: string;
  description: string;
  logoUrl?: string;
  isPublic: boolean;
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function Home() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{id: string; email: string; name: string; role: string} | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (token) {
        try {
          const decoded = jwtDecode<DecodedToken>(token);
          setUser({
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
          });
        } catch (error) {
          console.error('Error al decodificar token:', error);
        }
      }
    };

    const fetchSchools = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const token = Cookies.get('token');
        
        let response;
        if (token) {
          // Si hay token, obtenemos todas las escuelas del usuario
          response = await axios.get(`${apiUrl}/api/schools`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } else {
          // Si no hay token, solo obtenemos las escuelas públicas
          response = await axios.get(`${apiUrl}/api/schools/public`);
        }
        
        setSchools(response.data);
        setError('');
      } catch (error) {
        console.error('Error al cargar escuelas:', error);
        setError('No se pudieron cargar las escuelas. Por favor, intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    fetchSchools();
  }, []);

  const handleSchoolClick = (schoolId: string) => {
    router.push(`/school/${schoolId}`);
  };

  if (loading) {
    return <div className={styles.loading}>Cargando escuelas...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  const isLoggedIn = !!Cookies.get('token');

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          Bienvenido{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className={styles.description}>
          Conecta. Aprende. Crece.
        </p>

        {!user && (
          <div className={styles.authButtons}>
            <Link href="/login" className={styles.loginButton}>
              Iniciar Sesión
            </Link>
            <Link href="/register" className={styles.registerButton}>
              Registrarse
            </Link>
          </div>
        )}

        {schools.length === 0 ? (
          <p className={styles.noResults}>
            {user 
              ? 'No hay escuelas disponibles en este momento.' 
              : 'No hay escuelas públicas disponibles en este momento.'}
          </p>
        ) : (
          <div className={styles.grid}>
            {schools.map((school: any) => (
              <Link 
                href={`/school/${school._id}`} 
                key={school._id}
                className={styles.card}
              >
                {school.logoUrl ? (
                  <div className={styles.cardImage}>
                    <ImageFallback 
                      src={school.logoUrl}
                      alt={school.name}
                    />
                  </div>
                ) : (
                  <div className={styles.cardImagePlaceholder}>
                    <span>{school.name.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <h2>{school.name}</h2>
                <p>{school.description}</p>
                <div className={styles.cardFooter}>
                  <span className={styles.adminInfo}>
                    Director: {school.admin.name}
                  </span>
                  <span className={school.isPublic ? styles.public : styles.private}>
                    {school.isPublic ? 'Público' : 'Privado'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
} 