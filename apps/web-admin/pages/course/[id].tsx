import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import styles from '../../styles/Course.module.css';
import { FaPlus, FaTrashAlt, FaEdit, FaArrowLeft, FaUserPlus } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';
import { useApiErrorHandler } from '../../utils/api-error-handler';
import ImageFallback from '../../components/ImageFallback';
import { canModifyClass, canManageVideos } from '../../utils/permission-utils';
import { useMediaQuery } from 'react-responsive';
import PlaylistManager from '../../components/PlaylistManager';
import VideoPlayerWithTracking from '../../components/VideoPlayerWithTracking';
import LazyVideoLoader from '../../components/LazyVideoLoader';
import VideoJSPlayer from '../../components/VideoJSPlayer';
import SimpleVideoPlayer from '../../components/SimpleVideoPlayer';
import api from '../../utils/api-client';

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
  videoStatus?: 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR';
  videoProcessingError?: string;
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

interface SubmissionAuthor {
  _id?: string;
  name?: string;
  email?: string;
}

interface ClassSubmission {
  _id: string;
  student?: SubmissionAuthor;
  videoUrl?: string | null;
  videoStatus: 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR';
  reviewStatus: 'SUBMITTED' | 'REVIEWED' | 'NEEDS_RESUBMISSION';
  videoProcessingError?: string | null;
  annotationsCount?: number;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

const getSubmissionSortWeight = (submission: ClassSubmission): number => {
  if (submission.reviewStatus === 'SUBMITTED' && submission.videoStatus === 'READY') {
    return 0;
  }

  if (submission.reviewStatus === 'NEEDS_RESUBMISSION') {
    return 1;
  }

  if (
    submission.videoStatus === 'PROCESSING' ||
    submission.videoStatus === 'UPLOADING'
  ) {
    return 2;
  }

  if (submission.videoStatus === 'ERROR') {
    return 3;
  }

  return 4;
};

const getSubmissionStatusMeta = (
  submission: ClassSubmission,
): { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' } => {
  if (submission.videoStatus === 'ERROR') {
    return { label: 'Error al procesar', tone: 'danger' };
  }

  if (submission.videoStatus === 'PROCESSING') {
    return { label: 'Procesando', tone: 'warning' };
  }

  if (submission.videoStatus === 'UPLOADING') {
    return { label: 'Subiendo', tone: 'neutral' };
  }

  if (submission.reviewStatus === 'REVIEWED') {
    return { label: 'Feedback listo', tone: 'success' };
  }

  if (submission.reviewStatus === 'NEEDS_RESUBMISSION') {
    return { label: 'Reenvío solicitado', tone: 'warning' };
  }

  return { label: 'Sin revisar', tone: 'info' };
};

export default function CourseDetail() {
  const router = useRouter();
  const { id } = router.query;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(-1);
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const [useSimplePlayer, setUseSimplePlayer] = useState(false);
  const [classSubmissions, setClassSubmissions] = useState<ClassSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const videoColumnRef = useRef<HTMLDivElement>(null);
  const { handleApiError } = useApiErrorHandler();

  // Check authentication
  const checkAuth = () => {
    const token = Cookies.get('token');
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        
        
        setUserRole(decoded.role);
      } catch (error) {
        console.error('Error al decodificar token:', error);
      }
    } else {
      console.warn('No token found in cookies');
    }
  };
  
  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const fetchCourseAndClasses = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const token = Cookies.get('token');
        
        // Prepare headers - include authorization if token exists
        const headers: any = { 
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const courseResponse = await axios.get(`${apiUrl}/api/courses/${id}`, { headers });
        setCourse(courseResponse.data);
      } catch (error) {
        console.error('Error al obtener datos:', error);
        // Check if the error is due to authentication requirement
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          setError('Debes iniciar sesión para ver este curso');
        } else {
          setError(handleApiError(error));
        }
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
    
    // Update current video index
    const index = allClasses.findIndex(cls => cls._id === classItem._id);
    setCurrentVideoIndex(index);
    
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
    // This should compare teacherId with the user's ID, not role
    // Since we don't have the user's ID stored, we'll check if the course teacher matches
    return Boolean(course && teacherId && course.teacher._id === teacherId);
  }, [course]);

  const isTeacherOfCourse = useCallback((): boolean => {
    if (!userRole || !course) return false;
    // For now, check if the user has a teacher role (simplified)
    return userRole === 'teacher';
  }, [userRole, course]);

  const canModifyThisCourse = useCallback((): boolean => {
    if (!userRole || !course) return false;
    
    // Roles que pueden modificar cualquier curso
    if (['super_admin', 'admin'].includes(userRole)) return true;
    
    // School owner puede modificar cualquier curso en su escuela
    if (userRole === 'school_owner' && course.school) {
      // Aquí asumimos que hay una API que verifica si el usuario es dueño de la escuela
      // Idealmente, el backend debería proporcionar esta información en los datos del curso
      return true; // Simplificado, en realidad deberíamos comprobar la propiedad de la escuela
    }
    
    // Rol administrativo puede modificar cursos en su escuela
    if (userRole === 'administrative' && course.school) {
      // Mismo comentario que arriba sobre verificar la relación con la escuela
      return true; // Simplificado
    }
    
    // Teacher solo puede modificar sus propios cursos
    return userRole === 'teacher' && isTeacherOfCourse();
  }, [userRole, course, isTeacherOfCourse]);

  const canModifyClassItem = useCallback((): boolean => {
    if (!userRole || !course) return false;
    // Permisos globales
    if (["super_admin", "admin", "school_owner", "administrative"].includes(userRole)) return true;
    // Cualquier teacher del curso
    return isTeacherOfCourse();
  }, [userRole, course, isTeacherOfCourse]);

  const canReviewSelectedClass = useCallback((): boolean => {
    return Boolean(
      userRole &&
      ['teacher', 'administrative', 'school_owner', 'admin', 'super_admin'].includes(userRole)
    );
  }, [userRole]);

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
      
      // Trigger refresh of PlaylistManager
      setRefreshTrigger(prev => prev + 1);
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

  // Navigation functions
  const updateAllClasses = (playlists: any[]) => {
    const allClassesFromPlaylists = playlists.flatMap(playlist => playlist.classes || []);
    setAllClasses(allClassesFromPlaylists);
    
    // Update current video index
    if (selectedClass) {
      const index = allClassesFromPlaylists.findIndex(cls => cls._id === selectedClass._id);
      setCurrentVideoIndex(index);
    }
  };

  const handlePlaylistsLoaded = (playlists: any[]) => {
    updateAllClasses(playlists);
  };

  const navigateToVideo = (direction: 'previous' | 'next') => {
    if (allClasses.length === 0) return;
    
    let newIndex;
    if (direction === 'previous') {
      newIndex = currentVideoIndex > 0 ? currentVideoIndex - 1 : allClasses.length - 1;
    } else {
      newIndex = currentVideoIndex < allClasses.length - 1 ? currentVideoIndex + 1 : 0;
    }
    
    const nextClass = allClasses[newIndex];
    if (nextClass) {
      setCurrentVideoIndex(newIndex);
      handleClassClick(nextClass);
    }
  };

  const handlePreviousVideo = () => {
    navigateToVideo('previous');
  };

  const handleNextVideo = () => {
    navigateToVideo('next');
  };

  const getVideoStreamUrl = async (classId: string, retryCount = 0) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // First try without authentication for public classes
      try {
        console.log(`Attempting to get stream URL for class ${classId} without auth (attempt ${retryCount + 1})`);
        const response = await axios.get(`${apiUrl}/api/classes/${classId}/stream-url`);
        if (response.data && response.data.url) {
          console.log(`Successfully got stream URL for class ${classId} without auth`);
          setVideoStreamUrl(response.data.url);
          setVideoLoadError(false); // Reset error state on success
          return;
        }
      } catch (unauthError) {
        console.log(`Unauthenticated request failed for class ${classId}, trying with auth:`, unauthError);
      }

      // If unauthenticated request failed, try with authentication
      const token = Cookies.get('token');
      if (token) {
        const headers = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
        
        console.log(`Attempting to get stream URL for class ${classId} with auth (attempt ${retryCount + 1})`);
        const response = await axios.get(`${apiUrl}/api/classes/${classId}/stream-url`, { headers });
        if (response.data && response.data.url) {
          console.log(`Successfully got stream URL for class ${classId} with auth`);
          setVideoStreamUrl(response.data.url);
          setVideoLoadError(false); // Reset error state on success
          return;
        }
      }

      console.error('No se pudo obtener URL de streaming válida');
      // Don't clear the URL immediately, try retry first
      if (retryCount < 2) {
        console.log(`Retrying stream URL fetch for class ${classId} (attempt ${retryCount + 2})`);
        setTimeout(() => getVideoStreamUrl(classId, retryCount + 1), 1000 * (retryCount + 1));
      } else {
        setVideoStreamUrl(null);
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
    if (userRole && course) {
      const isTeacher = isClassTeacher(course.teacher._id);
      const canModify = canModifyClassItem();
      
      
    }
  }, [userRole, course, isClassTeacher, canModifyClassItem]);

  useEffect(() => {
    const fetchSelectedClassSubmissions = async () => {
      if (!selectedClass?._id || !canReviewSelectedClass()) {
        setClassSubmissions([]);
        setSubmissionsError(null);
        return;
      }

      try {
        setSubmissionsLoading(true);
        setSubmissionsError(null);
        const response = await api.get(`/class-submissions/class/${selectedClass._id}`);
        const nextSubmissions = (response.data || [])
          .slice()
          .sort((left: ClassSubmission, right: ClassSubmission) => {
            const weightDiff = getSubmissionSortWeight(left) - getSubmissionSortWeight(right);
            if (weightDiff !== 0) {
              return weightDiff;
            }

            const leftDate = new Date(left.submittedAt || 0).getTime();
            const rightDate = new Date(right.submittedAt || 0).getTime();
            return rightDate - leftDate;
          });

        setClassSubmissions(nextSubmissions);
      } catch (submissionError) {
        console.error('Could not fetch class submissions from course detail:', submissionError);
        setClassSubmissions([]);
        setSubmissionsError(
          (submissionError as any)?.response?.data?.message ||
          (submissionError as Error)?.message ||
          'No pudimos cargar las prácticas de esta clase.'
        );
      } finally {
        setSubmissionsLoading(false);
      }
    };

    void fetchSelectedClassSubmissions();
  }, [selectedClass?._id, canReviewSelectedClass]);

  const submissionSummary = {
    total: classSubmissions.length,
    pending: classSubmissions.filter(
      (submission) => submission.reviewStatus === 'SUBMITTED' && submission.videoStatus === 'READY'
    ).length,
    resubmission: classSubmissions.filter(
      (submission) => submission.reviewStatus === 'NEEDS_RESUBMISSION'
    ).length,
    reviewed: classSubmissions.filter(
      (submission) => submission.reviewStatus === 'REVIEWED'
    ).length,
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
              refreshTrigger={refreshTrigger}
              onPlaylistsLoaded={handlePlaylistsLoaded}
            />
            
            {canModifyThisCourse() && (
              <div className={styles.courseActions}>
                <Link href={`/admin/enrollment-management?courseId=${course._id}`} className={styles.enrollButton}>
                  <FaUserPlus className={styles.icon} /> Matricular estudiantes
                </Link>
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
                  {selectedClass.videoStatus === 'UPLOADING' ? (
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
                      <div style={{color: "#ffc107", fontSize: "48px", marginBottom: "20px"}}>⬆️</div>
                      <p style={{color: "white", fontSize: "18px", marginBottom: "10px", fontWeight: "bold"}}>Subiendo video...</p>
                      <p style={{color: "#a0aec0", fontSize: "14px"}}>Tu video se está subiendo al servidor</p>
                    </div>
                  ) : selectedClass.videoStatus === 'PROCESSING' ? (
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
                      <div style={{color: "#ffc107", fontSize: "48px", marginBottom: "20px"}}>⚙️</div>
                      <p style={{color: "white", fontSize: "18px", marginBottom: "10px", fontWeight: "bold"}}>Procesando video...</p>
                      <p style={{color: "#a0aec0", fontSize: "14px", marginBottom: "5px"}}>Optimizando calidad y formato</p>
                      <p style={{color: "#a0aec0", fontSize: "12px"}}>Esto puede tomar unos minutos</p>
                    </div>
                  ) : selectedClass.videoStatus === 'ERROR' ? (
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
                      <div style={{color: "#e53e3e", fontSize: "48px", marginBottom: "20px"}}>❌</div>
                      <p style={{color: "white", fontSize: "18px", marginBottom: "10px", fontWeight: "bold"}}>Error procesando video</p>
                      <p style={{color: "#a0aec0", fontSize: "14px"}}>{selectedClass.videoProcessingError || 'Error desconocido'}</p>
                    </div>
                  ) : selectedClass.videoUrl && selectedClass.videoStatus === 'READY' ? (
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
                        <div style={{color: "#e53e3e", fontSize: "48px", marginBottom: "20px"}}>⚠️</div>
                        <p style={{color: "white", marginBottom: "20px", fontSize: "18px", fontWeight: "bold"}}>Error cargando video</p>
                        <p style={{color: "#a0aec0", fontSize: "14px", marginBottom: "20px"}}>El reproductor avanzado no pudo cargar el video</p>
                        
                        <div style={{display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center"}}>
                          <button 
                            onClick={() => {
                              console.log('Trying simple player fallback');
                              setUseSimplePlayer(true);
                              setVideoLoadError(false);
                            }}
                            style={{
                              background: "#10b981", 
                              color: "white", 
                              padding: "10px 15px", 
                              borderRadius: "4px", 
                              border: "none",
                              cursor: "pointer",
                              fontWeight: "bold"
                            }}
                          >
                            Usar reproductor simple
                          </button>
                          
                          <button 
                            onClick={() => {
                              console.log('Retrying advanced player');
                              setVideoLoadError(false);
                              setUseSimplePlayer(false);
                            }}
                            style={{
                              background: "#3182ce", 
                              color: "white", 
                              padding: "10px 15px", 
                              borderRadius: "4px", 
                              border: "none",
                              cursor: "pointer",
                              fontWeight: "bold"
                            }}
                          >
                            Reintentar
                          </button>
                          
                          <a 
                            href={videoStreamUrl || selectedClass.videoUrl} 
                            target="_blank"
                            style={{
                              background: "#6b7280", 
                              color: "white", 
                              padding: "10px 15px", 
                              borderRadius: "4px", 
                              textDecoration: "none", 
                              fontWeight: "bold"
                            }}
                          >
                            Abrir en nueva pestaña
                          </a>
                        </div>
                      </div>
                    ) : useSimplePlayer ? (
                      <div style={{position: "relative"}}>
                        <SimpleVideoPlayer
                          src={videoStreamUrl || selectedClass.videoUrl}
                          title={selectedClass.title}
                          poster={selectedClass.thumbnailUrl}
                          preload="metadata"
                          crossOrigin="anonymous"
                          onPlay={() => {
                            console.log('Simple player: Video started playing:', selectedClass.title);
                          }}
                          onTimeUpdate={(currentTime, duration) => {
                            if (duration > 0) {
                              const progress = (currentTime / duration) * 100;
                              console.log(`Simple player: Video progress: ${progress.toFixed(1)}%`);
                            }
                          }}
                          onError={(error) => {
                            console.error('Simple player: Video playback error:', error);
                            setVideoLoadError(true);
                          }}
                        />
                        <div style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          background: "rgba(0, 0, 0, 0.7)",
                          color: "white",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "12px"
                        }}>
                          Reproductor Simple
                        </div>
                        <button
                          onClick={() => {
                            console.log('Switching back to advanced player');
                            setUseSimplePlayer(false);
                            setVideoLoadError(false);
                          }}
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            right: "8px",
                            background: "rgba(0, 0, 0, 0.7)",
                            color: "white",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          Usar reproductor avanzado
                        </button>
                      </div>
                    ) : (
                      <VideoPlayerWithTracking
                        url={videoStreamUrl || selectedClass.videoUrl}
                        title={selectedClass.title}
                        classId={selectedClass._id}
                        courseId={course._id}
                        schoolId={course.school._id}
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

                {canReviewSelectedClass() && (
                  <div className={styles.feedbackPreview}>
                    <div className={styles.feedbackPreviewHeader}>
                      <div>
                        <h3>Prácticas y feedback</h3>
                        <p>Resumen rápido de entregas para esta clase. La revisión detallada se abre en la vista de clase.</p>
                      </div>
                      <Link
                        href={`/class/${selectedClass._id}?courseId=${course._id}&from=course`}
                        className={styles.feedbackReviewLink}
                      >
                        Abrir revisión completa
                      </Link>
                    </div>

                    <div className={styles.feedbackSummaryGrid}>
                      <div className={styles.feedbackSummaryCard}>
                        <strong>{submissionSummary.total}</strong>
                        <span>Entregas</span>
                      </div>
                      <div className={styles.feedbackSummaryCard}>
                        <strong>{submissionSummary.pending}</strong>
                        <span>Sin revisar</span>
                      </div>
                      <div className={styles.feedbackSummaryCard}>
                        <strong>{submissionSummary.resubmission}</strong>
                        <span>Reenvíos</span>
                      </div>
                      <div className={styles.feedbackSummaryCard}>
                        <strong>{submissionSummary.reviewed}</strong>
                        <span>Revisadas</span>
                      </div>
                    </div>

                    {submissionsError ? (
                      <div className={styles.feedbackEmptyState}>{submissionsError}</div>
                    ) : submissionsLoading ? (
                      <div className={styles.feedbackEmptyState}>Cargando prácticas...</div>
                    ) : classSubmissions.length === 0 ? (
                      <div className={styles.feedbackEmptyState}>
                        Todavía no hay prácticas enviadas para esta clase.
                      </div>
                    ) : (
                      <div className={styles.feedbackSubmissionList}>
                        {classSubmissions.slice(0, 4).map((submission) => {
                          const statusMeta = getSubmissionStatusMeta(submission);
                          return (
                            <Link
                              key={submission._id}
                              href={`/class/${selectedClass._id}?courseId=${course._id}&from=course&submissionId=${submission._id}`}
                              className={styles.feedbackSubmissionItem}
                            >
                              <div className={styles.feedbackSubmissionTop}>
                                <strong>{submission.student?.name || submission.student?.email || 'Alumno'}</strong>
                                <span
                                  className={`${styles.feedbackSubmissionBadge} ${styles[`feedbackSubmissionBadge${statusMeta.tone.charAt(0).toUpperCase()}${statusMeta.tone.slice(1)}`]}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </div>
                              <p>
                                {submission.submittedAt
                                  ? new Date(submission.submittedAt).toLocaleString()
                                  : 'Sin fecha'}
                              </p>
                              <small>{submission.annotationsCount || 0} anotación(es)</small>
                            </Link>
                          );
                        })}
                        {classSubmissions.length > 4 && (
                          <div className={styles.feedbackMoreHint}>
                            Hay {classSubmissions.length - 4} práctica(s) más en la revisión completa.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Navigation buttons */}
                {allClasses.length > 1 && (
                  <div className={styles.videoNavigation}>
                    <button 
                      onClick={handlePreviousVideo}
                      className={styles.navButton}
                      disabled={false}
                    >
                      <span className={styles.navArrow}>‹</span>
                      <span className={styles.navText}>Anterior</span>
                    </button>
                    
                    <div className={styles.videoCounter}>
                      {currentVideoIndex + 1} de {allClasses.length}
                    </div>
                    
                    <button 
                      onClick={handleNextVideo}
                      className={styles.navButton}
                      disabled={false}
                    >
                      <span className={styles.navText}>Siguiente</span>
                      <span className={styles.navArrow}>›</span>
                    </button>
                  </div>
                )}
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
