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
        
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await axios.get(`${apiUrl}/api/schools`, { headers });
        setSchools(response.data);
      } catch (error) {
        console.error('Error al obtener escuelas:', error);
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

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Plataforma Educativa</h1>
        
        {user ? (
          <>
            <div className={styles.userWelcome}>
              <p>Bienvenido, {user.name}</p>
              {user.role === 'admin' && (
                <button 
                  className={styles.createButton}
                  onClick={() => router.push('/school/create')}
                >
                  Crear Nueva Escuela
                </button>
              )}
            </div>
            
            {loading ? (
              <div className={styles.loading}>Cargando escuelas...</div>
            ) : error ? (
              <div className={styles.error}>{error}</div>
            ) : schools.length === 0 ? (
              <div className={styles.noResults}>
                No hay escuelas disponibles en este momento.
              </div>
            ) : (
              <div className={styles.grid}>
                {schools.map((school) => (
                  <div 
                    key={school._id} 
                    className={styles.card}
                    onClick={() => handleSchoolClick(school._id)}
                  >
                    {school.logoUrl ? (
                      <div className={styles.cardImage}>
                        <ImageFallback 
                          src={school.logoUrl} 
                          alt={school.name} 
                          className={styles.schoolLogo}
                          placeholderClassName={styles.schoolLogoPlaceholder}
                        />
                      </div>
                    ) : (
                      <div className={styles.cardImagePlaceholder}>
                        <span>{school.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    <h2>{school.name}</h2>
                    <p>{school.description.length > 100 
                      ? `${school.description.substring(0, 100)}...` 
                      : school.description}
                    </p>
                    <div className={styles.cardFooter}>
                      <span className={school.isPublic ? styles.public : styles.private}>
                        {school.isPublic ? 'Público' : 'Privado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.description}>
              <p>Descubre escuelas y academias de baile cerca de ti</p>
            </div>
            
            <div className={styles.authButtons}>
              <Link href="/login" className={styles.loginButton}>
                Iniciar Sesión
              </Link>
              <Link href="/register" className={styles.registerButton}>
                Registrarse
              </Link>
            </div>

            {loading ? (
              <div className={styles.loading}>Cargando escuelas...</div>
            ) : error ? (
              <div className={styles.error}>{error}</div>
            ) : schools.length === 0 ? (
              <div className={styles.noResults}>
                No hay escuelas disponibles en este momento.
              </div>
            ) : (
              <div className={styles.grid}>
                {schools.map((school) => (
                  <div 
                    key={school._id} 
                    className={styles.card}
                    onClick={() => handleSchoolClick(school._id)}
                  >
                    {school.logoUrl ? (
                      <div className={styles.cardImage}>
                        <ImageFallback 
                          src={school.logoUrl} 
                          alt={school.name} 
                          className={styles.schoolLogo}
                          placeholderClassName={styles.schoolLogoPlaceholder}
                        />
                      </div>
                    ) : (
                      <div className={styles.cardImagePlaceholder}>
                        <span>{school.name.substring(0, 2).toUpperCase()}</span>
                      </div>
                    )}
                    <h2>{school.name}</h2>
                    <p>{school.description.length > 100 
                      ? `${school.description.substring(0, 100)}...` 
                      : school.description}
                    </p>
                    <div className={styles.cardFooter}>
                      <span className={school.isPublic ? styles.public : styles.private}>
                        {school.isPublic ? 'Público' : 'Privado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
} 