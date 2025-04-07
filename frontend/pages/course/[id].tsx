import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../styles/Course.module.css';

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
  school: {
    _id: string;
    name: string;
  };
  isPublic: boolean;
}

interface Class {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  order: number;
  isPublic: boolean;
}

export default function CourseDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

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
    
    const fetchCourseAndClasses = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const token = Cookies.get('token');
        
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Obtener información del curso
        const courseResponse = await axios.get(`${apiUrl}/api/courses/${id}`, { headers });
        setCourse(courseResponse.data);
        
        // Obtener clases del curso
        const classesResponse = await axios.get(`${apiUrl}/api/classes?courseId=${id}`, { headers });
        const sortedClasses = classesResponse.data.sort((a: Class, b: Class) => a.order - b.order);
        setClasses(sortedClasses);
        
        // Seleccionar la primera clase por defecto si hay clases disponibles
        if (sortedClasses.length > 0) {
          setSelectedClass(sortedClasses[0]);
        }
      } catch (error) {
        console.error('Error al obtener datos:', error);
        setError('No se pudo cargar la información. Por favor, intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseAndClasses();
  }, [id]);

  const handleClassClick = (classItem: Class) => {
    setSelectedClass(classItem);
  };
  
  const isTeacherOrAdmin = () => {
    if (!user || !course) return false;
    
    if (user.role === 'admin') return true;
    
    return course.teacher._id === user.id;
  };
  
  const getYouTubeEmbedUrl = (videoUrl: string) => {
    if (!videoUrl) return '';
    
    // Extraer el ID del video de YouTube desde diferentes formatos de URL
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = videoUrl.match(regExp);
    
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}`;
    }
    
    return '';
  };

  if (loading) {
    return <div className={styles.loading}>Cargando información...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!course) {
    return <div className={styles.error}>No se encontró el curso</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.courseHeader}>
          {course.coverImageUrl ? (
            <div className={styles.courseImage}>
              <img src={course.coverImageUrl} alt={course.title} />
            </div>
          ) : (
            <div className={styles.courseImagePlaceholder}>
              <span>{course.title.substring(0, 2).toUpperCase()}</span>
            </div>
          )}
          
          <div className={styles.courseInfo}>
            <h1 className={styles.title}>{course.title}</h1>
            <p className={styles.description}>{course.description}</p>
            <div className={styles.meta}>
              <span className={styles.teacher}>
                Prof. {course.teacher.name}
              </span>
              <span className={course.isPublic ? styles.public : styles.private}>
                {course.isPublic ? 'Público' : 'Privado'}
              </span>
              <Link href={`/school/${course.school._id}`}>
                <a className={styles.schoolLink}>
                  Escuela: {course.school.name}
                </a>
              </Link>
            </div>
          </div>
        </div>
        
        <div className={styles.courseContent}>
          <div className={styles.classesColumn}>
            <h2 className={styles.sectionTitle}>Clases del Curso</h2>
            
            {classes.length === 0 ? (
              <p className={styles.noResults}>Este curso aún no tiene clases disponibles.</p>
            ) : (
              <div className={styles.classesList}>
                {classes.map((classItem) => (
                  <div 
                    key={classItem._id} 
                    className={`${styles.classItem} ${selectedClass && selectedClass._id === classItem._id ? styles.selectedClass : ''}`}
                    onClick={() => handleClassClick(classItem)}
                  >
                    <div className={styles.classNumber}>{classItem.order}</div>
                    <div className={styles.classInfo}>
                      <h3>{classItem.title}</h3>
                      {classItem.duration && (
                        <span className={styles.duration}>
                          {Math.floor(classItem.duration / 60)}:{(classItem.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    {!classItem.isPublic && (
                      <div className={styles.lockIcon}>🔒</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {isTeacherOrAdmin() && (
              <div className={styles.adminActions}>
                <button 
                  className={styles.createButton}
                  onClick={() => router.push(`/class/create?courseId=${course._id}`)}
                >
                  Agregar Clase
                </button>
              </div>
            )}
          </div>
          
          <div className={styles.videoColumn}>
            {selectedClass ? (
              <>
                <div className={styles.videoContainer}>
                  <iframe
                    src={getYouTubeEmbedUrl(selectedClass.videoUrl)}
                    title={selectedClass.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
                <div className={styles.classDetails}>
                  <h2>{selectedClass.title}</h2>
                  <p>{selectedClass.description}</p>
                </div>
              </>
            ) : (
              <div className={styles.noVideoSelected}>
                <p>Selecciona una clase para comenzar a aprender</p>
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.backLink}>
          <Link href={`/school/${course.school._id}`}>
            <a>← Volver a la escuela</a>
          </Link>
        </div>
      </main>
    </div>
  );
} 