import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../styles/Admin.module.css';
import { jwtDecode } from 'jwt-decode';

interface User {
  _id: string;
  sub: string;
  name: string;
  email: string;
  role: string;
}

interface School {
  _id: string;
  name: string;
  description: string;
  logoUrl?: string;
  isPublic: boolean;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  school: School | string;
  isPublic: boolean;
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('schools');
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = parseJwt(token);
      setUser({
        _id: decoded.sub,
        sub: decoded.sub,
        name: decoded.name || '',
        email: decoded.email,
        role: decoded.role,
      });

      // Redireccionar si no es un rol válido para el admin panel
      if (!['admin', 'teacher'].includes(decoded.role)) {
        router.push('/');
      }

      fetchData(token);
    } catch (error) {
      console.error('Error al decodificar token:', error);
      Cookies.remove('token');
      router.push('/login');
    }
  }, [router]);

  const parseJwt = (token: string): DecodedToken => {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (e) {
      console.error('Error parsing JWT token', e);
      return { sub: '', name: '', email: '', role: '' };
    }
  };

  const fetchData = async (token: string) => {
    setLoading(true);
    setError('');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Obtener escuelas
      const schoolsResponse = await axios.get(
        `${apiUrl}/api/schools`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSchools(schoolsResponse.data);
      
      // Obtener cursos
      const coursesResponse = await axios.get(
        `${apiUrl}/api/courses`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setCourses(coursesResponse.data);

      // Obtener clases (si son profesor o admin)
      const classesResponse = await axios.get(
        `${apiUrl}/api/classes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setClasses(classesResponse.data);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError('Error al cargar los datos. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (isPublic: boolean) => {
    return isPublic 
      ? <span className={styles.publicBadge}>Público</span>
      : <span className={styles.privateBadge}>Privado</span>;
  };

  if (loading) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!user) {
    return <div className={styles.loading}>Verificando autenticación...</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Panel de Administración</h1>
          <div className={styles.userInfo}>
            <p>{user.name}</p>
            <span className={styles.roleBadge}>{user.role === 'admin' ? 'Administrador' : 'Profesor'}</span>
          </div>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'schools' ? styles.active : ''}`}
            onClick={() => setActiveTab('schools')}
          >
            Escuelas
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'courses' ? styles.active : ''}`}
            onClick={() => setActiveTab('courses')}
          >
            Cursos
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'classes' ? styles.active : ''}`}
            onClick={() => setActiveTab('classes')}
          >
            Clases
          </button>
          {user.role === 'admin' && (
            <button 
              className={`${styles.tabButton} ${activeTab === 'users' ? styles.active : ''}`}
              onClick={() => setActiveTab('users')}
            >
              Usuarios
            </button>
          )}
        </div>

        <div className={styles.actionBar}>
          {activeTab === 'schools' && (
            <Link href="/school/create" className={styles.createButton}>
              Nueva Escuela
            </Link>
          )}
          {activeTab === 'courses' && (
            <Link href="/course/create" className={styles.createButton}>
              Nuevo Curso
            </Link>
          )}
          {activeTab === 'classes' && (
            <Link href="/class/create" className={styles.createButton}>
              Nueva Clase
            </Link>
          )}
        </div>

        {activeTab === 'schools' && (
          <div className={styles.contentSection}>
            <h2 className={styles.sectionTitle}>Mis Escuelas</h2>
            {schools.length === 0 ? (
              <p className={styles.emptyMessage}>No tienes escuelas creadas. ¡Crea una ahora!</p>
            ) : (
              <div className={styles.grid}>
                {schools.map((school) => (
                  <div key={school._id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.logoContainer}>
                        {school.logoUrl ? (
                          <img src={school.logoUrl} alt={school.name} className={styles.logo} />
                        ) : (
                          <div className={styles.logoPlaceholder}>{school.name.charAt(0)}</div>
                        )}
                      </div>
                      <div className={styles.statusBadge}>
                        {getStatusBadge(school.isPublic)}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{school.name}</h3>
                      <p className={styles.cardDescription}>{school.description.substring(0, 100)}...</p>
                    </div>
                    <div className={styles.cardFooter}>
                      <Link href={`/school/${school._id}`} className={styles.viewButton}>
                        Ver detalles
                      </Link>
                      <Link href={`/school/edit/${school._id}`} className={styles.editButton}>
                        Editar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'courses' && (
          <div className={styles.contentSection}>
            <h2 className={styles.sectionTitle}>Mis Cursos</h2>
            {courses.length === 0 ? (
              <p className={styles.emptyMessage}>No tienes cursos creados. ¡Crea uno ahora!</p>
            ) : (
              <div className={styles.grid}>
                {courses.map((course) => (
                  <div key={course._id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.coverContainer}>
                        {course.coverImageUrl ? (
                          <img src={course.coverImageUrl} alt={course.title} className={styles.cover} />
                        ) : (
                          <div className={styles.coverPlaceholder}>{course.title.charAt(0)}</div>
                        )}
                      </div>
                      <div className={styles.statusBadge}>
                        {getStatusBadge(course.isPublic)}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{course.title}</h3>
                      <p className={styles.cardDescription}>{course.description.substring(0, 100)}...</p>
                      {typeof course.school === 'object' && (
                        <p className={styles.schoolName}>Escuela: {course.school.name}</p>
                      )}
                    </div>
                    <div className={styles.cardFooter}>
                      <Link href={`/course/${course._id}`} className={styles.viewButton}>
                        Ver detalles
                      </Link>
                      <Link href={`/course/edit/${course._id}`} className={styles.editButton}>
                        Editar
                      </Link>
                      <Link href={`/class/create?courseId=${course._id}`} className={styles.actionButton}>
                        Añadir Clase
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'classes' && (
          <div className={styles.contentSection}>
            <h2 className={styles.sectionTitle}>Mis Clases</h2>
            {classes.length === 0 ? (
              <p className={styles.emptyMessage}>No tienes clases creadas. ¡Crea una ahora!</p>
            ) : (
              <div className={styles.grid}>
                {classes.map((classItem) => (
                  <div key={classItem._id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.coverContainer}>
                        {classItem.thumbnailUrl ? (
                          <img src={classItem.thumbnailUrl} alt={classItem.title} className={styles.cover} />
                        ) : (
                          <div className={styles.coverPlaceholder}>{classItem.title.charAt(0)}</div>
                        )}
                      </div>
                      <div className={styles.statusBadge}>
                        {getStatusBadge(classItem.isPublic)}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{classItem.title}</h3>
                      <p className={styles.cardDescription}>{classItem.description.substring(0, 100)}...</p>
                      {classItem.course && typeof classItem.course === 'object' && (
                        <p className={styles.schoolName}>Curso: {classItem.course.title}</p>
                      )}
                    </div>
                    <div className={styles.cardFooter}>
                      <Link href={`/class/${classItem._id}`} className={styles.viewButton}>
                        Ver detalles
                      </Link>
                      <Link href={`/class/edit/${classItem._id}`} className={styles.editButton}>
                        Editar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && user.role === 'admin' && (
          <div className={styles.contentSection}>
            <h2 className={styles.sectionTitle}>Gestión de Usuarios</h2>
            <p className={styles.emptyMessage}>
              La gestión de usuarios se implementará próximamente.
            </p>
            <div className={styles.centerButtons}>
              <Link href="/admin/users" className={styles.createButton}>
                Ver todos los usuarios
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 