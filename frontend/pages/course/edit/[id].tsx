import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../../styles/Forms.module.css';

interface School {
  _id: string;
  name: string;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  school: School | string;
  isPublic: boolean;
}

export default function EditCourse() {
  const router = useRouter();
  const { id } = router.query;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Verificar si hay un token
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Asegurarse de que id sea un string válido
    if (id && typeof id === 'string') {
      fetchCourse(id, token);
      fetchSchools(token);
    }
  }, [id, router]);

  const fetchCourse = async (courseId: string, token: string) => {
    setLoading(true);
    setError('');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(
        `${apiUrl}/api/courses/${courseId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const courseData = response.data;
      setCourse(courseData);
      
      // Llenar los campos del formulario
      setTitle(courseData.title || '');
      setDescription(courseData.description || '');
      setCoverImageUrl(courseData.coverImageUrl || '');
      
      // Establecer el ID de la escuela
      if (typeof courseData.school === 'object' && courseData.school._id) {
        setSchoolId(courseData.school._id);
      } else if (typeof courseData.school === 'string') {
        setSchoolId(courseData.school);
      }
      
      setIsPublic(courseData.isPublic || false);
      
    } catch (error: any) {
      console.error('Error al obtener curso:', error);
      setError('Error al cargar los datos del curso. Verifica tu permiso o conexión.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(
        `${apiUrl}/api/schools`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSchools(response.data);
    } catch (error: any) {
      console.error('Error al obtener escuelas:', error);
      // No bloqueamos la UI por este error, simplemente mostramos un mensaje
      setError(prev => prev || 'No se pudieron cargar las escuelas. Algunas opciones pueden no estar disponibles.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación
    if (!title.trim() || !description.trim() || !schoolId) {
      setError('El título, la descripción y la escuela son obligatorios');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    const token = Cookies.get('token');
    if (!token) {
      setError('No hay sesión activa. Por favor, inicia sesión nuevamente.');
      setSaving(false);
      return;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const courseData = {
        title,
        description,
        coverImageUrl: coverImageUrl || undefined,
        schoolId,
        isPublic
      };
      
      const response = await axios.put(
        `${apiUrl}/api/courses/${id}`,
        courseData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSuccess('¡Curso actualizado con éxito!');
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push(`/course/${id}`);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error al actualizar curso:', error);
      
      if (error.response) {
        // Error con respuesta del servidor
        const errorMessage = error.response.data.message || 'Error al actualizar el curso';
        setError(`Error: ${errorMessage}`);
      } else if (error.request) {
        // Error sin respuesta del servidor
        setError('No se pudo conectar con el servidor. Verifica tu conexión.');
      } else {
        // Otro tipo de error
        setError('Error al enviar la solicitud. Por favor, intenta de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.container}>
      <div className={styles.loading}>Cargando información del curso...</div>
    </div>;
  }

  if (!course && !loading) {
    return <div className={styles.container}>
      <div className={styles.error}>No se pudo encontrar el curso solicitado.</div>
      <div className={styles.buttonContainer}>
        <Link href="/admin" className={styles.secondaryButton}>Volver al panel de administración</Link>
      </div>
    </div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Editar Curso</h1>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}><p>{error}</p></div>}
          {success && <div className={styles.success}><p>{success}</p></div>}
          
          <div className={styles.formGroup}>
            <label htmlFor="schoolId">Escuela*</label>
            <select
              id="schoolId"
              className={styles.select}
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
            >
              <option value="">Selecciona una escuela</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="title">Título del Curso*</label>
            <input
              type="text"
              id="title"
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={100}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="description">Descripción*</label>
            <textarea
              id="description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              minLength={10}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="coverImageUrl">URL de la Imagen de Portada</label>
            <input
              type="url"
              id="coverImageUrl"
              className={styles.input}
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg"
            />
            <small className={styles.inputHelp}>Ingresa la URL de una imagen para la portada del curso (opcional)</small>
          </div>
          
          <div className={styles.formGroup}>
            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <label htmlFor="isPublic">Curso público (visible para todos)</label>
            </div>
            <small className={styles.inputHelp}>
              Si está marcado, el curso será visible para todos los usuarios. De lo contrario, solo será visible para los miembros del curso.
            </small>
          </div>
          
          <div className={styles.buttonContainer}>
            <Link href={`/course/${id}`} className={styles.secondaryButton}>
              Cancelar
            </Link>
            <button 
              type="submit" 
              className={styles.button}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
} 