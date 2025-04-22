import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/CreateClass.module.css';

interface Course {
  _id: string;
  title: string;
  school: {
    name: string;
  };
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function CreateClass() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      if (decoded.role !== 'admin' && decoded.role !== 'teacher') {
        router.push('/dashboard');
        return;
      }

      fetchCourses(token);
    } catch (error) {
      console.error('Error decodificando token:', error);
      router.push('/login');
    }
  }, [router]);

  const fetchCourses = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(`${apiUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourses(response.data);
    } catch (error) {
      console.error('Error al obtener cursos:', error);
      setError('Error al cargar los cursos disponibles');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      if (!validTypes.includes(file.type)) {
        setError('Por favor, selecciona un archivo de video válido (mp4, webm, mov, avi)');
        return;
      }

      // Validar tamaño (100MB máximo)
      if (file.size > 100 * 1024 * 1024) {
        setError('El archivo es demasiado grande. El tamaño máximo es 100MB');
        return;
      }

      setSelectedVideo(file);
      setVideoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !description || !courseId || !selectedVideo) {
      setError('Todos los campos son obligatorios');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('courseId', courseId);
      formData.append('video', selectedVideo);
      
      await axios.post(
        `${apiUrl}/api/classes`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSuccess(true);
      
      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        router.push('/');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error al crear clase:', error);
      
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Error al crear la clase. Por favor, intenta de nuevo más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingCourses) {
    return <div className={styles.loadingContainer}>Cargando cursos disponibles...</div>;
  }

  if (courses.length === 0) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Crear Nueva Clase</h1>
          <div className={styles.noCourses}>
            <p>No tienes cursos asignados para crear clases.</p>
            <p>Primero debes crear un curso o ser asignado como profesor a uno existente.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Crear Nueva Clase</h1>
        
        {success ? (
          <div className={styles.success}>
            Clase creada exitosamente. Redirigiendo...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}
            
            <div className={styles.formGroup}>
              <label htmlFor="courseId">Curso*</label>
              <select
                id="courseId"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
              >
                <option value="">Selecciona un curso</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.title} - {course.school.name}
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
                placeholder="Describe el contenido de la clase, objetivos, etc."
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="video">Video de la Clase*</label>
              <input
                type="file"
                id="video"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                onChange={handleVideoChange}
                required
              />
              <p className={styles.inputHelp}>
                Formatos permitidos: MP4, WebM, MOV, AVI. Tamaño máximo: 100MB
              </p>
            </div>

            {videoPreview && (
              <div className={styles.videoPreview}>
                <video
                  src={videoPreview}
                  controls
                  style={{ maxWidth: '100%', marginBottom: '1rem' }}
                />
              </div>
            )}
            
            <button 
              type="submit" 
              className={styles.button} 
              disabled={loading}
            >
              {loading ? 'Creando...' : 'Crear Clase'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
} 