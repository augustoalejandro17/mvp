import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../styles/Course.module.css';
import { FaPlus, FaTrashAlt } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { useApiErrorHandler } from '../../utils/api-error-handler';

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

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function CourseDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{id: string; email: string; name: string; role: string} | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
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
        setError(handleApiError(error));
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
    if (!user) return false;
    
    // Usando el acceso seguro a los datos del usuario como están estructurados en la aplicación
    const userId = user?.id;
    if (!userId) return false;
    
    const isTeacher = course?.teacher && course.teacher._id === userId;
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    
    return isTeacher || isAdmin;
  };
  
  const handleDeleteCourse = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar este curso? Esta acción no se puede deshacer.')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      if (!token) {
        setError('Debes iniciar sesión para realizar esta acción');
        setIsDeleting(false);
        return;
      }
      
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      await axios.delete(`${apiUrl}/api/courses/${id}`, { headers });
      
      // Redirigir a la página principal después de eliminar
      router.push('/');
    } catch (error) {
      console.error('Error al eliminar curso:', error);
      setError(handleApiError(error));
      setIsDeleting(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta clase? Esta acción no se puede deshacer.')) {
      return;
    }
    
    setDeletingClassId(classId);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      if (!token) {
        setError('Debes iniciar sesión para realizar esta acción');
        return;
      }
      
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      await axios.delete(`${apiUrl}/api/classes/${classId}`, { headers });
      
      // Actualizar la lista de clases
      setClasses(classes.filter(c => c._id !== classId));
      
      // Si la clase eliminada era la seleccionada, deseleccionarla
      if (selectedClass && selectedClass._id === classId) {
        setSelectedClass(null);
      }
    } catch (error) {
      console.error('Error al eliminar la clase:', error);
      setError(handleApiError(error));
    } finally {
      setDeletingClassId(null);
    }
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
              <Link href={`/school/${course.school._id}`} className={styles.schoolLink}>
                Escuela: {course.school.name}
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
                  >
                    <div 
                      className={styles.classContent}
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
                    
                    {isTeacherOrAdmin() && (
                      <div className={styles.classActions}>
                        <button 
                          className={styles.classActionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/class/${classItem._id}`);
                          }}
                          title="Ver detalles"
                        >
                          👁️
                        </button>
                        <button 
                          className={styles.classActionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClass(classItem._id);
                          }}
                          disabled={deletingClassId === classItem._id}
                          title="Eliminar clase"
                        >
                          {deletingClassId === classItem._id ? "⏳" : <FaTrashAlt />}
                        </button>
                      </div>
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
                  <FaPlus /> Agregar Clase
                </button>
                <button 
                  onClick={() => router.push(`/course/attendance/${course._id}`)} 
                  className={styles.attendanceButton}
                >
                  Control de Asistencia
                </button>
                <button 
                  onClick={handleDeleteCourse} 
                  className={styles.deleteButton}
                  disabled={isDeleting}
                >
                  <FaTrashAlt /> {isDeleting ? 'Eliminando...' : 'Eliminar Curso'}
                </button>
              </div>
            )}
          </div>
          
          <div className={styles.videoColumn}>
            {selectedClass ? (
              <>
                <div className={styles.videoContainer}>
                  {selectedClass && (
                    <>
                      <video
                        src={selectedClass.videoUrl}
                        controls
                        playsInline
                        className={styles.videoPlayer}
                        poster="/video-placeholder.jpg"
                        crossOrigin="anonymous"
                        autoPlay={false}
                        onLoadStart={() => console.log('Iniciando carga del video:', selectedClass.videoUrl)}
                        onError={(e) => {
                          console.error('Error al cargar el video:', e);
                          console.log('URL problemática:', selectedClass.videoUrl);
                          
                          // Intentar abrir el video directamente si está en el curso
                          const videoContainer = document.querySelector(`.${styles.videoContainer}`);
                          if (videoContainer) {
                            videoContainer.innerHTML = `
                              <div style="padding: 20px; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #000;">
                                <p style="color: white; margin-bottom: 20px;">No se pudo cargar el video en el reproductor.</p>
                                <button 
                                  onclick="window.open('${selectedClass.videoUrl}', '_blank')"
                                  style="background: #3182ce; color: white; padding: 10px 15px; border-radius: 4px; text-decoration: none; font-weight: bold; border: none; cursor: pointer;"
                                >
                                  Abrir video en nueva pestaña
                                </button>
                              </div>
                            `;
                          }
                        }}
                      >
                        <source src={selectedClass.videoUrl} type="video/mp4" />
                        <source src={selectedClass.videoUrl} type="video/webm" />
                        <source src={selectedClass.videoUrl} type="video/quicktime" />
                        Tu navegador no soporta la reproducción de videos.
                      </video>
                    </>
                  )}
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
            ← Volver a la escuela
          </Link>
        </div>
      </main>
    </div>
  );
} 