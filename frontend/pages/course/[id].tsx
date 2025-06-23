import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../styles/Course.module.css';
import { FaPlus, FaTrashAlt, FaEdit, FaUserCheck, FaArrowLeft } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { useApiErrorHandler } from '../../utils/api-error-handler';
import ImageFallback from '../../components/ImageFallback';
import { canModifyClass, canManageVideos, canManageAttendance } from '../../utils/permission-utils';
import { useMediaQuery } from 'react-responsive';
import PlaylistManager from '../../components/PlaylistManager';
import VideoPlayerWithTracking from '../../components/VideoPlayerWithTracking';

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
  teachers?: { _id: string; name: string; email: string }[];
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{id: string; email: string; name: string; role: string} | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { handleApiError } = useApiErrorHandler();
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const videoColumnRef = useRef<HTMLDivElement>(null);


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
    const fetchCourseAndClasses = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const token = Cookies.get('token');
        
        if (!token) {
          setError('Debes iniciar sesión para ver este curso');
          setLoading(false);
          return;
        }
        
        const headers = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
        
        const courseResponse = await axios.get(`${apiUrl}/api/courses/${id}`, { headers });
        setCourse(courseResponse.data);
      } catch (error) {
        console.error('Error al obtener datos:', error);
        setError(handleApiError(error));
      } finally {
        setLoading(false);
      }
    };

    fetchCourseAndClasses();
  }, [id, handleApiError]);

  useEffect(() => {
    if (course) {
      
    }
  }, [course]);

  const handleClassClick = (classItem: Class) => {
    console.log('Class clicked:', classItem.title, 'videoUrl:', classItem.videoUrl);
    setSelectedClass(classItem);
    setVideoLoadError(false); // Resetear el estado de error al cambiar de clase
    
    // Check if the provided videoUrl looks valid (has signature parameters or is recent)
    const isValidSignedUrl = classItem.videoUrl && (
      classItem.videoUrl.includes('X-Amz-Signature') || 
      classItem.videoUrl.includes('CloudFront-Signature') ||
      classItem.videoUrl.includes('Signature')
    );
    
    if (isValidSignedUrl) {
      console.log('Using provided signed URL for class:', classItem.title);
      setVideoStreamUrl(classItem.videoUrl);
    } else {
      console.log('Provided URL may be invalid/expired, fetching new stream URL for class:', classItem.title);
      setVideoStreamUrl(null); // Clear current URL to show loading state
    }
    
    // Auto-scroll to video section on mobile devices
    if (window.innerWidth <= 768) {
      // Small delay to ensure the video section has been updated
      setTimeout(() => {
        if (videoColumnRef.current) {
          // Add a brief highlight effect to show the user where the video is
          const originalBoxShadow = videoColumnRef.current.style.boxShadow;
          const originalTransition = videoColumnRef.current.style.transition;
          
          videoColumnRef.current.style.transition = 'box-shadow 0.3s ease';
          videoColumnRef.current.style.boxShadow = '0 0 0 3px rgba(49, 130, 206, 0.5), 0 4px 12px rgba(49, 130, 206, 0.15)';
          
          videoColumnRef.current.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
          
          // Remove highlight after scroll animation
          setTimeout(() => {
            if (videoColumnRef.current) {
              videoColumnRef.current.style.boxShadow = originalBoxShadow;
              videoColumnRef.current.style.transition = originalTransition;
            }
          }, 1200);
        }
      }, 200);
    }
    
    // Always try to get fresh streaming URL in the background for better reliability
    if (classItem._id) {
      getVideoStreamUrl(classItem._id);
    }
  };
  
  const isClassTeacher = useCallback((teacherId: string | undefined): boolean => {
    return Boolean(user?.id && teacherId && teacherId === user.id);
  }, [user]);

  const isTeacherOfCourse = useCallback((): boolean => {
    if (!user || !course) return false;
    if (course.teacher._id === user.id) return true;
    if (Array.isArray(course.teachers)) {
      return course.teachers.some(t => t._id === user.id);
    }
    return false;
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

  const canModifyClassItem = useCallback((): boolean => {
    if (!user || !course) return false;
    // Permisos globales
    if (["super_admin", "admin", "school_owner", "administrative"].includes(user.role)) return true;
    // Cualquier teacher del curso
    return isTeacherOfCourse();
  }, [user, course, isTeacherOfCourse]);

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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
      
      // Si la clase eliminada era la seleccionada, deseleccionarla
      if (selectedClass && selectedClass._id === classId) {
        setSelectedClass(null);
      }
    } catch (error) {
      console.error('Error al eliminar la clase:', error);
      setError(handleApiError(error));
    }
  };

  // New handlers for PlaylistManager
  const handleClassView = (classItem: Class) => {
    handleClassClick(classItem);
  };

  const handleClassEdit = (classId: string) => {
    router.push(`/class/edit/${classId}`);
  };

  const getVideoStreamUrl = async (classId: string, retryCount = 0) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      console.log(`Attempting to get stream URL for class ${classId} (attempt ${retryCount + 1})`);
      const response = await axios.get(`${apiUrl}/api/classes/${classId}/stream-url`, { headers });
      if (response.data && response.data.url) {
        console.log(`Successfully got stream URL for class ${classId}`);
        setVideoStreamUrl(response.data.url);
        setVideoLoadError(false); // Reset error state on success
      } else {
        console.error('No se pudo obtener URL de streaming válida');
        // Don't clear the URL immediately, try retry first
        if (retryCount < 2) {
          console.log(`Retrying stream URL fetch for class ${classId} (attempt ${retryCount + 2})`);
          setTimeout(() => getVideoStreamUrl(classId, retryCount + 1), 1000 * (retryCount + 1));
        } else {
          setVideoStreamUrl(null);
        }
      }
    } catch (error) {
      console.error('Error al obtener URL de streaming:', error);
      
      // Retry logic for intermittent failures
      if (retryCount < 2) {
        console.log(`Retrying stream URL fetch for class ${classId} (attempt ${retryCount + 2}) after error`);
        setTimeout(() => getVideoStreamUrl(classId, retryCount + 1), 1000 * (retryCount + 1));
      } else {
        console.error(`Failed to get stream URL for class ${classId} after 3 attempts`);
        setVideoStreamUrl(null);
      }
    }
  };

  useEffect(() => {
    if (user && course) {
      const isTeacher = isClassTeacher(course.teacher._id);
      const canModify = canModifyClassItem();
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
              <p className={styles.teacher}>
                <span className={styles.teacherLabel}>Prof.</span> {course.teacher.name}
              </p>
              <div className={styles.tags}>
                <span className={styles.schoolInfo}>
                  <span className={styles.schoolLabel}>Escuela:</span> {course.school.name}
                </span>
                <span className={course.isPublic ? styles.public : styles.private}>
                  {course.isPublic ? 'Público' : 'Privado'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.backLink}>
          <Link href={`/school/${course.school._id}`}>
            <FaArrowLeft /> <span>Volver a la escuela</span>
          </Link>
        </div>
        
        <div className={styles.courseContent}>
          <div className={styles.classesList}>
            <h2 className={styles.sectionTitle}>Clases del Curso</h2>
            <PlaylistManager
              courseId={course._id}
              onClassSelect={handleClassClick}
              selectedClass={selectedClass}
              canModify={canModifyThisCourse()}
              onClassView={handleClassView}
              onClassEdit={handleClassEdit}
              onClassDelete={handleDeleteClass}
            />
            
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
          
          <div ref={videoColumnRef} className={styles.videoColumn}>
            {selectedClass ? (
              <>
                <div style={{ 
                  width: '100%',
                  minHeight: '400px',
                  backgroundColor: '#000',
                  borderRadius: '8px',
                  overflow: 'visible',
                  position: 'relative'
                }}>
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
                      <VideoPlayerWithTracking
                        url={videoStreamUrl || selectedClass.videoUrl}
                        title={selectedClass.title}
                        classId={selectedClass._id}
                        courseId={course?._id}
                        schoolId={course?.school._id}
                        allowDownload={false}
                      />
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
      </main>
    </div>
  );
} 