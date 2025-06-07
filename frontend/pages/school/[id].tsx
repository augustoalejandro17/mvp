import { useState, useEffect, useCallback } from 'react';
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

  // New states for filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);

  const fetchSchoolAndCourses = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      const headers: any = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Get school details
      const schoolResponse = await axios.get(`${apiUrl}/api/schools/${id}`, { headers });
      const schoolData = schoolResponse.data;
      
      setSchool(schoolData);
      
      // Get courses for this school
      try {
        const coursesResponse = await axios.get(`${apiUrl}/api/courses?schoolId=${id}`, { headers });
        const coursesData = coursesResponse.data;
        // Si no hay token, filtrar solo cursos públicos
        const filteredCourses = token ? coursesData : coursesData.filter((course: Course) => course.isPublic);
        setCourses(filteredCourses);
      } catch (error) {
        console.error('Error al obtener cursos:', error);
        setCourses([]); // En caso de error, inicializar como array vacío
      }
      
    } catch (error) {
      console.error('Error al obtener datos:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  }, [id, router, handleApiError]);

  // Modificamos el useEffect para que solo se ejecute cuando tengamos un ID
  useEffect(() => {
    if (id) {
      fetchSchoolAndCourses();
    }
  }, [id, fetchSchoolAndCourses]);

  // useEffect for filtering courses
  useEffect(() => {
    let tempCourses = courses;

    // Filter by search term
    if (searchTerm) {
      tempCourses = tempCourses.filter(course => 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by selected teacher
    if (selectedTeacherId) {
      tempCourses = tempCourses.filter(course => course.teacher._id === selectedTeacherId);
    }

    setFilteredCourses(tempCourses);
  }, [courses, searchTerm, selectedTeacherId]);

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

  const isLoggedIn = !!user;

  if (!id || loading) {
    return <div className={styles.loading}>Cargando información...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
        <button 
          onClick={() => router.push('/')}
          className={styles.backButton}
        >
          Volver a la página principal
        </button>
      </div>
    );
  }

  if (!school) {
    return (
      <div className={styles.error}>
        <p>No se encontró la escuela</p>
        <button 
          onClick={() => router.push('/')}
          className={styles.backButton}
        >
          Volver a la página principal
        </button>
      </div>
    );
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
        
        {/* Filters: Search bar and Teacher dropdown - styled like admin filters */}
        <div className={styles.searchFilterRow}>
          <div className={styles.searchWrapper}>
            <input 
              type="text"
              placeholder="Buscar cursos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.input}
            />
          </div>
          {school.teachers && school.teachers.length > 0 && (
            <div className={styles.filterWrapper}>
              <select 
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className={styles.select}
              >
                <option value="">Todos los Profesores</option>
                {school.teachers.map(teacher => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <h2 className={styles.sectionTitle}>Cursos Disponibles</h2>
        
        {!isLoggedIn && (
          <div className={styles.publicNotice}>
            <p>Estás viendo el contenido público. Para ver todo el contenido, por favor 
              <Link href="/login" className={styles.loginLink}> inicia sesión</Link>.
            </p>
          </div>
        )}
        
        {courses.length === 0 ? (
          <p className={styles.noResults}>
            {isLoggedIn 
              ? 'Esta escuela aún no tiene cursos disponibles.'
              : 'Esta escuela aún no tiene cursos públicos disponibles.'}
          </p>
        ) : (
          <div className={styles.grid}>
            {filteredCourses.map((course) => (
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
                      style={{
                        '--image-position': 'center center'
                      } as React.CSSProperties}
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
                    <span className={styles.teacherLabel}>Prof.</span> {course.teacher.name}
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