import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../styles/School.module.css';
import { FaTrashAlt, FaEdit } from 'react-icons/fa';

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
}

export default function SchoolDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [school, setSchool] = useState<School | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (token) {
        try {
          const decoded = JSON.parse(atob(token.split('.')[1]));
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
        const schoolResponse = await axios.get(`${apiUrl}/api/schools/${id}`, { headers });
        setSchool(schoolResponse.data);
        
        // Obtener cursos de la escuela
        const coursesResponse = await axios.get(`${apiUrl}/api/courses?schoolId=${id}`, { headers });
        setCourses(coursesResponse.data);
      } catch (error) {
        console.error('Error al obtener datos:', error);
        setError('No se pudo cargar la información. Por favor, intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolAndCourses();
  }, [id]);

  const handleCourseClick = (courseId: string) => {
    router.push(`/course/${courseId}`);
  };
  
  const isTeacherOrAdmin = () => {
    if (!user || !school) return false;
    
    if (user.role === 'admin') return true;
    
    return school.teachers?.some(teacher => teacher._id === user.id) || 
           school.admin?._id === user.id;
  };

  const isSchoolAdmin = () => {
    if (!user || !school) return false;
    
    if (user.role === 'admin') return true;
    
    return school.admin?._id === user.id;
  };
  
  const handleDeleteSchool = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta escuela? Esta acción no se puede deshacer.')) {
      return;
    }
    
    try {
      setLoading(true);
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
      setError('No se pudo eliminar la escuela. Verifica que tienes los permisos necesarios.');
      setLoading(false);
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
              <img src={school.logoUrl} alt={school.name} />
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
                className={styles.card}
                onClick={() => handleCourseClick(course._id)}
              >
                {course.coverImageUrl ? (
                  <div className={styles.cardImage}>
                    <img src={course.coverImageUrl} alt={course.title} />
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
            <button 
              className={styles.createButton}
              onClick={() => router.push(`/course/create?schoolId=${school._id}`)}
            >
              Crear Nuevo Curso
            </button>
            
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
          <Link href="/">
            <a>← Volver a la página principal</a>
          </Link>
        </div>
      </main>
    </div>
  );
} 