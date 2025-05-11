import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../styles/Course.module.css';
import { FaPlus, FaTrashAlt, FaEye, FaEdit, FaUserCheck, FaSpinner } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { useApiErrorHandler } from '../../utils/api-error-handler';
import ImageFallback from '../../components/ImageFallback';
import { canModifyClass, canManageVideos, canManageAttendance } from '../../utils/permission-utils';

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
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
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
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState(false);

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
      } else {
        console.warn('No token found in cookies');
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
          // Pre-cargar URL de streaming para la primera clase
          if (sortedClasses[0]._id) {
            getVideoStreamUrl(sortedClasses[0]._id);
          }
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

  useEffect(() => {
    if (course) {
      
    }
  }, [course]);

  const handleClassClick = (classItem: Class) => {
    setSelectedClass(classItem);
    setVideoStreamUrl(null); // Resetear la URL de streaming para mostrar el mensaje "Cargando video..."
    setVideoLoadError(false); // Resetear el estado de error al cambiar de clase
    
    // Usar la URL directa de inmediato para mostrar el video
    // mientras obtenemos la URL de streaming optimizada
    setVideoStreamUrl(classItem.videoUrl);
    
    // Obtener URL de streaming para el video en segundo plano
    if (classItem._id) {
      getVideoStreamUrl(classItem._id);
    }
  };
  
  const isClassTeacher = useCallback((teacherId: string | undefined): boolean => {
    return Boolean(user?.id && teacherId && teacherId === user.id);
  }, [user]);

  const isTeacherOfCourse = useCallback((): boolean => {
    if (!user || !course) return false;
    return course.teacher._id === user.id;
  }, [user, course]);

  const canModifyThisCourse = useCallback((): boolean => {
    if (!user || !course) return false;
    
    // Roles que pueden modificar cualquier curso
    if (['super_admin', 'admin'].includes(user.role)) return true;
    
    // School owner puede modificar cualquier curso en su escuela
    if (user.role === 'school_owner' && course.school) {
      // Aquí asumimos que hay una API que verifica si el usuario es dueño de la escuela
      // Idealmente, el backend debería proporcionar esta información en los datos del curso
      return true; // Simplificado, en realidad deberíamos comprobar la propiedad de la escuela
    }
    
    // Rol administrativo puede modificar cursos en su escuela
    if (user.role === 'administrative' && course.school) {
      // Mismo comentario que arriba sobre verificar la relación con la escuela
      return true; // Simplificado
    }
    
    // Teacher solo puede modificar sus propios cursos
    return user.role === 'teacher' && isTeacherOfCourse();
  }, [user, course, isTeacherOfCourse]);

  const canModifyClassItem = useCallback((teacherId: string | undefined): boolean => {
    if (!user?.role || !teacherId || !course) return false;
    
    // Roles que pueden modificar clases en cualquier curso
    if (['super_admin', 'admin'].includes(user.role)) return true;
    
    // School owner y administrative pueden modificar clases en sus escuelas
    if (['school_owner', 'administrative'].includes(user.role) && course.school) {
      // Aquí necesitaríamos verificar la relación con la escuela
      return true; // Simplificado
    }
    
    // El profesor del curso puede modificar las clases en su curso
    if (isTeacherOfCourse()) return true;
    
    // Teacher que creó la clase específica también puede modificarla
    const hasPermission = canModifyClass(user.role, isClassTeacher(teacherId));
    return hasPermission;
  }, [user, course, isTeacherOfCourse, isClassTeacher]);

  const canTakeAttendance = useCallback((teacherId: string | undefined): boolean => {
    if (!user?.role || !teacherId || !course) return false;
    
    // Administradores globales pueden tomar asistencia en cualquier curso
    if (['super_admin', 'admin'].includes(user.role)) return true;
    
    // School owner y administrative pueden tomar asistencia en sus escuelas
    if (['school_owner', 'administrative'].includes(user.role) && course.school) {
      // Necesitaríamos verificar la relación con la escuela
      return true; // Simplificado
    }
    
    // El profesor del curso siempre puede tomar asistencia
    if (isTeacherOfCourse()) return true;
    
    // Verificamos si el profesor de la clase específica puede tomar asistencia
    const hasPermission = canManageAttendance(user.role, isClassTeacher(teacherId));
    return hasPermission;
  }, [user, course, isTeacherOfCourse, isClassTeacher]);

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

  const getVideoStreamUrl = async (classId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      const response = await axios.get(`${apiUrl}/api/classes/${classId}/stream-url`, { headers });
      if (response.data && response.data.url) {
        setVideoStreamUrl(response.data.url);
        
      } else {
        setVideoStreamUrl(null);
        console.error('No se pudo obtener URL de streaming válida');
      }
    } catch (error) {
      console.error('Error al obtener URL de streaming:', error);
      setVideoStreamUrl(null);
    }
  };

  useEffect(() => {
    if (user && course) {
      const isTeacher = isClassTeacher(course.teacher._id);
      const canModify = canModifyClassItem(course.teacher._id);
      const canAttend = canTakeAttendance(course.teacher._id);
      
      
    }
  }, [user, course, isClassTeacher, canModifyClassItem, canTakeAttendance]);

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
          <div className={styles.coverImage}>
            <ImageFallback
              src={course.coverImageUrl || '/img/default-course.jpg'}
              alt={course.title}
              className={styles.coverImg}
            />
          </div>
          <div className={styles.courseInfo}>
            <h1 className={styles.title}>{course.title}</h1>
            <p className={styles.description}>{course.description}</p>
            <div className={styles.meta}>
              <p className={styles.teacher}>Prof. {course.teacher.name}</p>
              <div className={styles.tags}>
                <span className={styles.publicTag}>{course.isPublic ? 'Público' : 'Privado'}</span>
                <span className={styles.schoolTag}>Escuela: {course.school.name}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.courseContent}>
          <div className={styles.classesList}>
            <h2 className={styles.sectionTitle}>Clases del Curso</h2>
            
            {classes.length === 0 ? (
              <div className={styles.noClasses}>
                <p>Este curso aún no tiene clases disponibles.</p>
              </div>
            ) : (
              <ul className={styles.classList}>
                {classes.map((classItem) => (
                  <li 
                    key={classItem._id} 
                    className={`${styles.classItem} ${selectedClass?._id === classItem._id ? styles.active : ''}`}
                  >
                    <div 
                      className={styles.classContent}
                      onClick={() => handleClassClick(classItem)}
                    >
                      <div className={styles.classInfo}>
                        <h3 className={styles.classTitle}>{classItem.title}</h3>
                        {classItem.duration && (
                          <span className={styles.duration}>
                            {Math.floor(classItem.duration / 60)}:{(classItem.duration % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className={styles.classActions}>
                      <button 
                        className={styles.classActionBtn}
                        onClick={() => handleClassClick(classItem)}
                        title="Ver detalles"
                      >
                        <FaEye />
                      </button>
                      
                      {(user?.role === 'super_admin' || (classItem.createdBy && canModifyClassItem(classItem.createdBy._id))) && (
                        <>
                          <Link 
                            href={`/class/edit/${classItem._id}`}
                            className={styles.classActionBtn}
                            title="Editar clase"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FaEdit />
                          </Link>
                          
                          <button 
                            className={styles.classActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClass(classItem._id);
                            }}
                            disabled={deletingClassId === classItem._id}
                            title="Eliminar clase"
                          >
                            {deletingClassId === classItem._id ? (
                              <FaSpinner className={styles.spinner} />
                            ) : (
                              <FaTrashAlt />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            
            {canModifyThisCourse() && (
              <div className={styles.courseActions}>
                <Link href={`/class/create?courseId=${course._id}`} className={styles.addButton}>
                  <FaPlus className={styles.icon} /> Agregar Clase
                </Link>
                <Link href={`/course/edit/${course._id}`} className={styles.editButton}>
                  <FaEdit className={styles.icon} /> Editar Curso
                </Link>
                <button
                  className={styles.deleteButton}
                  onClick={handleDeleteCourse}
                  disabled={isDeleting}
                >
                  <FaTrashAlt className={styles.icon} /> Eliminar Curso
                </button>
              </div>
            )}

            {course.teacher && canTakeAttendance(course.teacher._id) && (
              <Link href={`/course/attendance/${course._id}`} className={styles.attendanceButton}>
                <FaUserCheck className={styles.icon} /> Control de Asistencia
              </Link>
            )}
          </div>
          
          <div className={styles.videoColumn}>
            {selectedClass ? (
              <>
                <div className={styles.videoContainer}>
                  {selectedClass.videoUrl ? (
                    videoLoadError ? (
                      <div style={{
                        padding: "20px", 
                        textAlign: "center",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        background: "#000",
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%"
                      }}>
                        <p style={{color: "white", marginBottom: "20px"}}>No se pudo cargar el video en el reproductor.</p>
                        <a 
                          href={videoStreamUrl || selectedClass.videoUrl} 
                          target="_blank"
                          style={{background: "#3182ce", color: "white", padding: "10px 15px", borderRadius: "4px", textDecoration: "none", fontWeight: "bold"}}
                        >
                          Abrir video en nueva pestaña
                        </a>
                      </div>
                    ) : (
                      <video
                        key={videoStreamUrl || selectedClass.videoUrl} // Usar cualquier URL disponible
                        src={videoStreamUrl || selectedClass.videoUrl}
                        controls
                        playsInline
                        className={styles.videoPlayer}
                        autoPlay={false}
                        onError={(e) => {
                          console.error('Error al cargar el video:', e);
                          setVideoLoadError(true);
                        }}
                      >
                        <source src={videoStreamUrl || selectedClass.videoUrl} type="video/mp4" />
                        <source src={videoStreamUrl || selectedClass.videoUrl} type="video/webm" />
                        Tu navegador no soporta la reproducción de videos.
                      </video>
                    )
                  ) : (
                    <div style={{
                      padding: "20px",
                      textAlign: "center",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      background: "#000",
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%"
                    }}>
                      <p style={{color: "white", marginBottom: "20px"}}>No hay video disponible</p>
                    </div>
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