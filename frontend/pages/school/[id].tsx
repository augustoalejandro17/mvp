import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../styles/School.module.css';
import { FaTrashAlt, FaEdit, FaPlus } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { useApiErrorHandler } from '../../utils/api-error-handler';
import ImageFallback from '../../components/ImageFallback';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface School {
  _id: string;
  name: string;
  description: string;
  logoUrl?: string;
  admin: {
    _id: string;
    name: string;
    email: string;
  };
  teachers: {
    _id: string;
    name: string;
    email: string;
  }[];
  students: {
    _id: string;
    name: string;
    email: string;
  }[];
  isPublic: boolean;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  teacher: {
    _id: string;
    name: string;
    email: string;
  };
  isPublic: boolean;
  isFeatured?: boolean;
  promotionOrder?: number;
}

export default function SchoolDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [school, setSchool] = useState<School | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{id: string; email: string; name: string; role: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { handleApiError } = useApiErrorHandler();

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
    
    checkAuth();
  }, []);

  useEffect(() => {
    if (!id) return;
    
    const fetchSchoolAndCourses = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const token = Cookies.get('token');
        
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Obtener información de la escuela
        const schoolResponse = await axios.get(`${apiUrl}/api/schools/${id}`, { headers })
          .catch(error => {
            console.error('Error al obtener información de la escuela:', error);
            if (error.response) {
              console.error('Respuesta del servidor:', error.response.status, error.response.data);
            }
            throw error;
          });
        
        setSchool(schoolResponse.data);
        
        // Obtener cursos de la escuela
        const coursesResponse = await axios.get(`${apiUrl}/api/courses?schoolId=${id}`, { headers })
          .catch(error => {
            console.error('Error al obtener cursos de la escuela:', error);
            if (error.response) {
              console.error('Respuesta del servidor:', error.response.status, error.response.data);
            }
            throw error;
          });
        
        // Sort courses by promotionOrder and then alphabetically by title
        const sortedCourses = [...coursesResponse.data].sort((a, b) => {
          // Primero ordenar por promotionOrder (los números más bajos primero)
          if (a.promotionOrder !== b.promotionOrder) {
            return (a.promotionOrder || 999) - (b.promotionOrder || 999);
          }
          // Luego ordenar alfabéticamente por título
          return a.title.localeCompare(b.title, 'es', { sensitivity: 'accent' });
        });
        
        setCourses(sortedCourses);
      } catch (error) {
        console.error('Error al obtener datos:', error);
        setError(handleApiError(error));
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolAndCourses();
  }, [id]);

  const handleCourseClick = (courseId: string) => {
    router.push(`/course/${courseId}`);
  };
  
  const handleCreateCourseClick = () => {
    if (!school) return;
    
    console.log('Redirigiendo a crear curso para la escuela:', school._id);
    
    // Usar window.open para garantizar que se abre en la misma ventana
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/course/create?schoolId=${school._id}`;
    console.log('URL de redirección:', url);
    
    // Implementación más robusta con fallback
    try {
      // Intento 1: usando window.location.href
      window.location.href = url;
    } catch (error) {
      console.error('Error al redirigir usando window.location.href:', error);
      try {
        // Intento 2: usando window.open
        window.open(url, '_self');
      } catch (error2) {
        console.error('Error al redirigir usando window.open:', error2);
        // Intento 3: usando Next.js router como último recurso
        router.push(`/course/create?schoolId=${school._id}`);
      }
    }
  };
  
  const isTeacherOrAdmin = () => {
    if (!user || !school) return false;
    
    // Super admin y admin global pueden editar cualquier escuela
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    
    // Verificar si el usuario es profesor o administrador de esta escuela específica
    return school.teachers?.some(teacher => teacher._id === user.id) || 
           school.admin?._id === user.id || 
           user.role === 'school_owner' && school.admin?._id === user.id || 
           user.role === 'administrative' && school.teachers?.some(teacher => teacher._id === user.id);
  };

  const isSchoolAdmin = () => {
    if (!user || !school) return false;
    
    // Super admin y admin global pueden administrar cualquier escuela
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    
    // Solo el admin de la escuela (school owner) puede administrarla
    return school.admin?._id === user.id || 
           user.role === 'school_owner' && school.admin?._id === user.id;
  };
  
  const handleDeleteSchool = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta escuela? Esta acción no se puede deshacer.')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      if (!token) {
        setError('Debes iniciar sesión para realizar esta acción');
        setLoading(false);
        return;
      }
      
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      await axios.delete(`${apiUrl}/api/schools/${id}`, { headers });
      
      // Redirigir a la página principal después de eliminar
      router.push('/');
    } catch (error) {
      console.error('Error al eliminar la escuela:', error);
      setError(handleApiError(error));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando información...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!school) {
    return <div className={styles.error}>No se encontró la escuela</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.schoolHeader}>
          {school.logoUrl ? (
            <div className={styles.schoolLogo}>
              <ImageFallback 
                src={school.logoUrl}
                alt={school.name}
              />
            </div>
          ) : (
            <div className={styles.schoolLogoPlaceholder}>
              <span>{school.name.substring(0, 2).toUpperCase()}</span>
            </div>
          )}
          
          <div className={styles.schoolInfo}>
            <h1 className={styles.title}>{school.name}</h1>
            <p className={styles.description}>{school.description}</p>
            <div className={styles.meta}>
              <span className={school.isPublic ? styles.public : styles.private}>
                {school.isPublic ? 'Público' : 'Privado'}
              </span>
              <span className={styles.adminInfo}>
                Director: {school.admin.name}
              </span>
            </div>
          </div>
        </div>
        
        <h2 className={styles.sectionTitle}>Cursos Disponibles</h2>
        
        {courses.length === 0 ? (
          <p className={styles.noResults}>Esta escuela aún no tiene cursos disponibles.</p>
        ) : (
          <div className={styles.grid}>
            {courses.map((course) => (
              <div 
                key={course._id} 
                className={`${styles.card} ${course.isFeatured ? styles.featuredCard : ''}`}
                onClick={() => handleCourseClick(course._id)}
              >
                {course.isFeatured && (
                  <div className={styles.featuredBadge}>Destacado</div>
                )}
                {course.coverImageUrl ? (
                  <div className={styles.cardImage}>
                    <ImageFallback 
                      src={course.coverImageUrl}
                      alt={course.title}
                    />
                  </div>
                ) : (
                  <div className={styles.cardImagePlaceholder}>
                    <span>{course.title.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <h3>{course.title}</h3>
                <p>{course.description.length > 100 
                  ? `${course.description.substring(0, 100)}...` 
                  : course.description}
                </p>
                <div className={styles.cardFooter}>
                  <span className={styles.teacher}>
                    Prof. {course.teacher.name}
                  </span>
                  <span className={course.isPublic ? styles.public : styles.private}>
                    {course.isPublic ? 'Público' : 'Privado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {isTeacherOrAdmin() && (
          <div className={styles.adminActions}>
            <a 
              href={`/course/create?schoolId=${school._id}`}
              className={styles.createButton}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <FaPlus style={{ marginRight: '8px' }} /> Crear Nuevo Curso
            </a>
            
            {isSchoolAdmin() && (
              <>
                <button 
                  className={`${styles.actionButton} ${styles.editButton}`}
                  onClick={() => router.push(`/school/edit/${school._id}`)}
                >
                  <FaEdit /> Editar Escuela
                </button>
                <button 
                  className={`${styles.actionButton} ${styles.deleteButton}`}
                  onClick={handleDeleteSchool}
                >
                  <FaTrashAlt /> Eliminar Escuela
                </button>
              </>
            )}
          </div>
        )}
        
        <div className={styles.backLink}>
          <button onClick={() => router.push('/')}>
            Volver a la página principal
          </button>
        </div>
      </main>
    </div>
  );
} 