import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/Forms.module.css';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

interface Course {
  _id: string;
  name: string;
  description: string;
  school: string;
  teacher: string;
}

export default function CreateClass() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [courseId, setCourseId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  useEffect(() => {
    // Verificar autenticación
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
      setUserId(decoded.sub);
      setUserRole(decoded.role);

      // Cargar cursos disponibles
      fetchCourses(token, decoded.sub, decoded.role);
    } catch (error) {
      console.error('Error decodificando token:', error);
      router.push('/login');
    }
  }, [router]);

  const fetchCourses = async (token: string, userId: string, role: string) => {
    try {
      setLoadingCourses(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Diferentes endpoints según el rol
      const endpoint = role === 'admin' 
        ? `${apiUrl}/api/courses` 
        : `${apiUrl}/api/courses/teacher/${userId}`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setCourses(response.data);
      
      // Si hay cursos disponibles, selecciona el primero por defecto
      if (response.data.length > 0) {
        setCourseId(response.data[0]._id);
      }
    } catch (error) {
      console.error('Error al cargar cursos:', error);
      setError('No se pudieron cargar los cursos disponibles');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (!title || !description || !videoUrl || !courseId) {
      setError('Todos los campos son obligatorios');
      return;
    }

    // Validar URL de YouTube
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!youtubeRegex.test(videoUrl)) {
      setError('La URL del video debe ser de YouTube');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      await axios.post(
        `${apiUrl}/api/classes`, 
        { 
          title, 
          description, 
          videoUrl, 
          course: courseId
        },
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          } 
        }
      );
      
      setSuccess(true);
      
      // Redirigir al curso después de 2 segundos
      setTimeout(() => {
        router.push(`/course/${courseId}`);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error al crear clase:', error);
      
      if (error.response && error.response.data && error.response.data.message) {
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
          <div className={styles.error}>
            No tienes cursos asignados. Para crear una clase, primero debes tener acceso a un curso.
          </div>
          <button 
            onClick={() => router.push('/course/create')} 
            className={styles.button}
            style={{ marginTop: '20px' }}
          >
            Crear un Curso
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Crear Nueva Clase</h1>
        
        {success ? (
          <div className={styles.successMessage}>
            <p>¡Clase creada con éxito! Redirigiendo...</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {error && <p className={styles.error}>{error}</p>}
            
            <div className={styles.formGroup}>
              <label htmlFor="courseId">Curso*</label>
              <select
                id="courseId"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
                className={styles.select}
              >
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>{course.name}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="title">Título de la Clase*</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
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
                rows={4}
                placeholder="Describe el contenido de la clase, objetivos, etc."
              ></textarea>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="videoUrl">URL del Video (YouTube)*</label>
              <input
                type="url"
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                required
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className={styles.inputHelp}>Debe ser una URL de YouTube válida</p>
            </div>
            
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Creando...' : 'Crear Clase'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
} 