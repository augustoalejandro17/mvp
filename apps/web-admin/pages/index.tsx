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
  admin?: {
    name?: string;
  };
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
  const [showOnboardingSuccess, setShowOnboardingSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (router.query.onboarded === 'true') {
      setShowOnboardingSuccess(true);
      router.replace('/', undefined, { shallow: true });
      setTimeout(() => setShowOnboardingSuccess(false), 5000);
    }

    const checkAuth = async () => {
      const token = Cookies.get('token');
      if (token) {
        try {
          const decoded = jwtDecode<DecodedToken>(token);

          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL;
            const profileResponse = await axios.get(`${apiUrl}/api/auth/profile`, {
              headers: { Authorization: `Bearer ${token}` }
            });

            const userProfile = profileResponse.data;

            if (!userProfile.hasOnboarded && router.pathname !== '/onboarding') {
              router.push('/onboarding');
              return;
            }
          } catch (profileError) {
            console.error('Error checking onboarding status:', profileError);
          }

          setUser({
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
          });
        } catch (decodeError) {
          console.error('Error al decodificar token:', decodeError);
        }
      }
    };

    const fetchSchools = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const token = Cookies.get('token');

        const response = token
          ? await axios.get(`${apiUrl}/api/schools`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          : await axios.get(`${apiUrl}/api/schools/public`);

        setSchools(response.data);
        setError('');
      } catch (fetchError) {
        console.error('Error al cargar escuelas:', fetchError);
        setError('No se pudieron cargar las escuelas. Por favor, intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    fetchSchools();
  }, [router]);

  if (loading) {
    return (
      <div className={styles.loadingShell}>
        <div className={styles.loading}>Cargando escuelas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.loadingShell}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleSchools = schools.filter((school) => {
    if (!normalizedSearch) return true;

    const haystacks = [
      school.name,
      school.description,
      school.admin?.name,
      school.isPublic ? 'publico' : 'privado',
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return haystacks.some((value) => value.includes(normalizedSearch));
  });

  return (
    <div className={styles.container}>
      <div className={styles.backgroundGlow} />
      <div className={`${styles.backgroundGlow} ${styles.backgroundGlowAlt}`} />
      <main className={styles.main}>
        {showOnboardingSuccess && (
          <div className={styles.successMessage}>
            Configuracion completada. Tu cuenta ya esta lista.
          </div>
        )}

        <section className={styles.heroSection}>
          <h1 className={styles.title}>
            Bienvenido{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className={styles.description}>
            Conecta. Aprende. Crece.
          </p>
        </section>

        {!user && (
          <div className={styles.authButtons}>
            <Link href="/login" className={styles.loginButton}>
              Iniciar Sesion
            </Link>
            <Link href="/register" className={styles.registerButton}>
              Registrarse
            </Link>
          </div>
        )}

        {schools.length === 0 ? (
          <section className={styles.emptyState}>
            <h2>No hay escuelas para mostrar</h2>
            <p className={styles.noResults}>
              {user
                ? 'Todavia no hay escuelas disponibles en este momento.'
                : 'Todavia no hay escuelas publicas disponibles en este momento.'}
            </p>
          </section>
        ) : (
          <>
            <div className={styles.sectionHeader}>
              <h2>Explora escuelas</h2>
            </div>
            <div className={styles.searchRow}>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por escuela, descripción o director..."
                className={styles.searchInput}
              />
            </div>
            {visibleSchools.length === 0 ? (
              <section className={styles.emptyState}>
                <h2>No encontramos escuelas con esa búsqueda</h2>
                <p className={styles.noResults}>
                  Prueba con otro nombre, una palabra de la descripción o el nombre del director.
                </p>
              </section>
            ) : (
            <div className={styles.grid}>
              {visibleSchools.map((school) => (
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
                  <div className={styles.cardContent}>
                    <div className={styles.cardHeader}>
                      <h3>{school.name}</h3>
                      <span className={school.isPublic ? styles.public : styles.private}>
                        {school.isPublic ? 'Publico' : 'Privado'}
                      </span>
                    </div>
                    <p>{school.description}</p>
                  </div>
                  <div className={styles.cardFooter}>
                    <span className={styles.adminInfo}>
                      <span className={styles.directorLabel}>Director:</span>{' '}
                      {school.admin?.name ?? 'Sin asignar'}
                    </span>
                    <span className={styles.cardAction}>Ver escuela</span>
                  </div>
                </Link>
              ))}
            </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
