import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { jwtDecode } from 'jwt-decode';
import styles from '../../../styles/CreateClass.module.css';
import axios from 'axios';
import { useApiErrorHandler } from '../../../utils/api-error-handler';
import { FaSpinner } from 'react-icons/fa';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface Course {
  _id: string;
  title: string;
  school: {
    name: string;
  };
}

interface ClassData {
  _id: string;
  title: string;
  description: string;
  videoUrl?: string;
  course: {
    _id: string;
    title: string;
  };
  courseId?: string;
}

interface CreatorTermsStatus {
  accepted: boolean;
  acceptedAt?: string;
  acceptedVersion?: string;
  requiredVersion: string;
}

export default function EditClass() {
  const router = useRouter();
  const { id } = router.query;
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Data
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [creatorTermsStatus, setCreatorTermsStatus] = useState<CreatorTermsStatus | null>(null);
  const [acceptCreatorTermsChecked, setAcceptCreatorTermsChecked] = useState(false);
  
  const { handleApiError } = useApiErrorHandler();

  // Fetch available courses
  const fetchCourses = useCallback(async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await axios.get(`${apiUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setError(handleApiError(error));
    } finally {
      setLoadingCourses(false);
    }
  }, [handleApiError]);

  const fetchCreatorTermsStatus = useCallback(async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await axios.get(`${apiUrl}/api/auth/creator-terms/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCreatorTermsStatus(response.data);
    } catch (error) {
      console.error('Error fetching creator terms status:', error);
      setError(handleApiError(error));
    }
  }, [handleApiError]);

  // Fetch class data
  const fetchClassData = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      const response = await axios.get(`${apiUrl}/api/classes/${id}`, { headers });
      const data = response.data;
      
      setClassData(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setCourseId(data.courseId || data.course?._id || '');
      setIsPublic(data.isPublic || false);
      setCurrentVideoUrl(data.videoUrl || null);
      
    } catch (error) {
      console.error('Error al obtener datos de la clase:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  }, [id, handleApiError]);

  // Permission check and initialization
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const normalizedRole = String(decoded.role).toLowerCase();
      const hasPermission = normalizedRole === 'admin' || 
                          normalizedRole === 'teacher' || 
                          normalizedRole === 'super_admin' ||
                          normalizedRole === 'school_owner' ||
                          normalizedRole === 'administrative';
      
      if (!hasPermission) {
        router.push('/dashboard');
        return;
      }

      // Load data
      fetchCourses(token);
      fetchClassData();
      fetchCreatorTermsStatus(token);
    } catch (error) {
      console.error('Error decodificando token:', error);
      router.push('/login');
    }
  }, [router, fetchCourses, fetchClassData, fetchCreatorTermsStatus]);

  // Handle video selection
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      if (!validTypes.includes(file.type)) {
        setError('Por favor, selecciona un archivo de video válido (mp4, webm, mov, avi)');
        return;
      }

      // Validate file size (100MB max)
      if (file.size > 100 * 1024 * 1024) {
        setError('El archivo es demasiado grande. El tamaño máximo es 100MB');
        return;
      }

      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !description || !courseId) {
      setError('Título, descripción y curso son obligatorios');
      return;
    }

    try {
      setSaving(true);
      setError('');
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      let response;
      
      if (selectedVideo) {
        if (!creatorTermsStatus?.accepted) {
          if (!acceptCreatorTermsChecked) {
            setError('Debes aceptar los términos de creador para reemplazar videos.');
            setSaving(false);
            return;
          }

          const termsResponse = await axios.patch(
            `${apiUrl}/api/auth/creator-terms/accept`,
            { version: creatorTermsStatus?.requiredVersion },
            { headers: { Authorization: `Bearer ${token}` } },
          );
          setCreatorTermsStatus(termsResponse.data);
        }

        // If uploading a video, use FormData
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('courseId', courseId);
        formData.append('isPublic', isPublic.toString());
        formData.append('video', selectedVideo);
        
        response = await axios.put(
          `${apiUrl}/api/classes/${id}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': `Bearer ${token}`
            }
          }
        );
      } else {
        // If not uploading video, send JSON
        const updateData = {
          title,
          description,
          courseId,
          isPublic
        };
        
        response = await axios.put(
          `${apiUrl}/api/classes/${id}`,
          updateData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }
        );
      }
      
      setSuccess('Clase actualizada exitosamente. Redirigiendo...');
      
      // Redirect to course page after 2 seconds
      setTimeout(() => {
        router.push(`/course/${courseId}`);
      }, 2000);
      
    } catch (error) {
      console.error('Error updating class:', error);
      setError(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading || loadingCourses) {
    return <div className={styles.loadingContainer}>Cargando datos de la clase...</div>;
  }

  // Error state
  if (error && !classData) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.error}>{error}</div>
          <button 
            onClick={() => router.back()} 
            className={styles.cancelButton}
          >
            Volver
          </button>
        </main>
      </div>
    );
  }

  // Class not found
  if (!classData && !loading) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.error}>No se encontró la clase solicitada</div>
          <button 
            onClick={() => router.back()} 
            className={styles.cancelButton}
          >
            Volver
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Editar Clase</h1>
        
        {success ? (
          <div className={styles.success}>
            {success}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}
            
            {saving && (
              <div className={styles.formOverlay}>
                <div className={styles.overlayContent}>
                  <FaSpinner className={styles.overlaySpinner} />
                  <p>Actualizando clase...</p>
                </div>
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label htmlFor="courseId">Curso*</label>
              <select
                id="courseId"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
                className={styles.select}
                disabled={saving}
              >
                <option value="">Selecciona un curso</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.title} {course.school && `- ${course.school.name}`}
                  </option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="title">Título*</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                placeholder="Ej: Introducción a los pasos básicos"
                className={styles.input}
                disabled={saving}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="description">Descripción*</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                rows={4}
                placeholder="Describe el contenido y objetivos de esta clase"
                className={styles.textarea}
                disabled={saving}
              />
            </div>
            
            {/* Current video display */}
            {currentVideoUrl && (
              <div className={styles.formGroup}>
                <label>Video Actual</label>
                <div className={styles.currentVideo}>
                  <video 
                    src={currentVideoUrl} 
                    controls 
                    style={{ 
                      width: '100%', 
                      maxHeight: '300px',
                      objectFit: 'contain',
                      backgroundColor: '#000',
                      borderRadius: '4px'
                    }}
                    controlsList="nodownload noremoteplayback"
                    onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
                  />
                  <p className={styles.inputHelp}>
                    Selecciona un nuevo video abajo para reemplazar el actual (opcional)
                  </p>
                </div>
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label htmlFor="video">
                {currentVideoUrl ? 'Nuevo Video (opcional)' : 'Video*'}
              </label>
              <input
                type="file"
                id="video"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                onChange={handleVideoChange}
                className={styles.fileInput}
                disabled={saving}
                required={!currentVideoUrl}
              />
              <p className={styles.inputHelp}>
                Formatos soportados: MP4, WebM, MOV, AVI. Tamaño máximo: 100MB
              </p>
            </div>
            
                         {/* New video preview */}
             {videoPreview && (
               <div className={styles.formGroup}>
                 <label>Vista Previa del Nuevo Video</label>
                 <div className={styles.videoPreview}>
                   <video 
                     src={videoPreview} 
                     controls 
                     style={{ 
                       width: '100%', 
                       maxHeight: '300px',
                       objectFit: 'contain',
                       backgroundColor: '#000',
                       borderRadius: '4px'
                     }}
                     controlsList="nodownload noremoteplayback"
                     onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
                   />
                 </div>
               </div>
             )}

             {/* Public checkbox */}
             <div className={styles.formGroup}>
               <label className={styles.checkboxLabel}>
                 <input
                   type="checkbox"
                   id="isPublic"
                   checked={isPublic}
                   onChange={(e) => setIsPublic(e.target.checked)}
                   disabled={saving}
                 />
                 Clase pública (visible para todos)
               </label>
               <p className={styles.inputHelp}>
                 Si está marcado, la clase será visible para todos los usuarios. De lo contrario, solo será visible para los miembros del curso.
               </p>
             </div>

             {!creatorTermsStatus?.accepted && selectedVideo && (
               <div className={styles.formGroup}>
                 <label className={styles.checkboxLabel}>
                   <input
                     type="checkbox"
                     checked={acceptCreatorTermsChecked}
                     onChange={(e) => setAcceptCreatorTermsChecked(e.target.checked)}
                     disabled={saving}
                   />
                   Confirmo que el nuevo video cumple políticas de comunidad y derechos de autor.
                 </label>
                 <p className={styles.inputHelp}>
                   Se registrará la aceptación de términos de creador versión {creatorTermsStatus?.requiredVersion || 'vigente'}.
                 </p>
                 <p className={styles.inputHelp}>
                   Revisa los términos en <Link href="/creator-terms">/creator-terms</Link>.
                 </p>
               </div>
             )}
             
                          <div className={styles.buttonGroup}>
               <button 
                 type="submit" 
                 className={styles.button}
                 disabled={saving || (!!selectedVideo && !creatorTermsStatus?.accepted && !acceptCreatorTermsChecked)}
               >
                 {saving ? 'Actualizando...' : 'Actualizar Clase'}
               </button>
               
               <button 
                 type="button"
                 onClick={() => {
                   // Try to go to course page, fallback to previous page
                   if (courseId) {
                     router.push(`/course/${courseId}`);
                   } else if (classData?.course?._id) {
                     router.push(`/course/${classData.course._id}`);
                   } else {
                     router.back();
                   }
                 }}
                 className={styles.cancelButton}
                 disabled={saving}
               >
                 Cancelar
               </button>
             </div>
          </form>
        )}
      </main>
    </div>
  );
} 
