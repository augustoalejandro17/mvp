import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/CourseForm.module.css';
import ImageUploader from '../../components/ImageUploader';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

interface School {
  _id: string;
  name: string;
  description: string;
  admin: string;
}

export default function CreateCourse() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    // Verificar autenticación
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      
      
      // Solo admin y teacher pueden crear cursos
      if (!['admin', 'teacher'].includes(decoded.role)) {
        router.push('/');
        return;
      }
      
      setUserId(decoded.sub);
      
      // Cargar las escuelas disponibles
      fetchSchools(token, decoded.sub, decoded.role);
      
    } catch (error) {
      console.error('Error decodificando token:', error);
      router.push('/login');
    }
  }, [router]);

  const fetchSchools = async (token: string, userId: string, role: string) => {
    try {
      setLoadingSchools(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Diferentes endpoints según el rol
      const endpoint = role === 'admin' 
        ? `${apiUrl}/api/schools` 
        : `${apiUrl}/api/schools/teacher/${userId}`;
      
      
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      
      
      setSchools(response.data);
      
      // Si hay escuelas disponibles, selecciona la primera por defecto
      if (response.data.length > 0) {
        setSchoolId(response.data[0]._id);
      } else {
        
      }
    } catch (error) {
      console.error('Error al cargar escuelas:', error);
      setError('No se pudieron cargar las escuelas disponibles');
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleImageUpload = (imageUrl: string) => {
    setImageUrl(imageUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (!name || !description || !schoolId) {
      setError('Todos los campos marcados con * son obligatorios');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      if (!token) {
        setError('No hay token de autenticación disponible');
        setLoading(false);
        return;
      }
      
      // Añadir información de usuario para debugging
      let userInfo = '';
      try {
        const decoded = jwtDecode<any>(token);
        
        userInfo = `Usuario: ${decoded.email} (${decoded.role}), ID: ${decoded.sub}`;
      } catch (e) {
        console.error('Error al decodificar token para logs:', e);
        userInfo = 'Error al decodificar token';
      }
      
      // Datos para enviar
      const courseData = {
        title: name, 
        description, 
        coverImageUrl: imageUrl || null, 
        isPublic,
        schoolId,
        teacher: userId
      };
      
      // Mostrar información de depuración
      const debugData = `
        URL API: ${apiUrl}/api/courses
        Método: POST
        
        ${userInfo}
        
        Datos enviados:
        ${JSON.stringify(courseData, null, 2)}
      `;
      
      setDebugInfo(debugData);
      
      
      
      
      
      
      const response = await axios.post(
        `${apiUrl}/api/courses`, 
        courseData,
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          } 
        }
      );
      
      
      
      setSuccess(true);
      setDebugInfo(debugInfo + `\n\nRespuesta: ${JSON.stringify(response.data, null, 2)}`);
      
      // Redirigir al dashboard después de 2 segundos
      setTimeout(() => {
        router.push('/');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error al crear curso:', error);
      
      if (error.response) {
        console.error('Detalles de la respuesta de error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: JSON.stringify(error.response.data)
        });
        
        setDebugInfo(debugInfo + `\n\nError: ${error.response.status} ${error.response.statusText}
          Detalles: ${JSON.stringify(error.response.data, null, 2)}
        `);
        
        if (error.response.data && error.response.data.message) {
          // Para mensajes simples
          if (typeof error.response.data.message === 'string') {
            setError(error.response.data.message);
          } 
          // Para arrays de mensajes (validación)
          else if (Array.isArray(error.response.data.message)) {
            setError(error.response.data.message.join(', '));
          }
        } else if (error.response.status === 401) {
          setError('No tienes autorización para crear cursos en esta escuela');
        } else {
          setError(`Error ${error.response.status}: ${error.response.statusText || 'Error desconocido'}`);
        }
      } else if (error.request) {
        console.error('Error de red - no se recibió respuesta:', error.request);
        setError('Error de red: no se pudo conectar con el servidor. Verifica tu conexión.');
        setDebugInfo(debugInfo + `\n\nError de red: No se recibió respuesta del servidor.`);
      } else {
        console.error('Error de configuración de solicitud:', error.message);
        setError('Error al crear el curso. Por favor, intenta de nuevo más tarde.');
        setDebugInfo(debugInfo + `\n\nError: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingSchools) {
    return <div className={styles.loadingContainer}>Cargando escuelas disponibles...</div>;
  }

  if (schools.length === 0) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Crear Nuevo Curso</h1>
          <div className={styles.error}>
            No tienes escuelas asignadas. Para crear un curso, primero debes tener acceso a una escuela.
          </div>
          <button 
            onClick={() => router.push('/school/create')} 
            className={styles.button}
            style={{ marginTop: '20px' }}
          >
            Crear una Escuela
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Crear Nuevo Curso</h1>
        
        {success ? (
          <div className={styles.success}>
            <p>¡Curso creado con éxito! Redirigiendo...</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <div className={styles.error}>
                <p>{error}</p>
                {error.includes('autorización') && (
                  <p className={styles.inputHelp}>
                    Esto puede ocurrir si no eres profesor o administrador de la escuela seleccionada.
                    Asegúrate de que estás intentando crear un curso en una escuela donde tienes permisos.
                  </p>
                )}
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label htmlFor="schoolId">Escuela*</label>
              <select
                id="schoolId"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                required
                className={styles.select}
              >
                {schools.map((school) => (
                  <option key={school._id} value={school._id}>{school.name}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="name">Nombre del Curso*</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ej: Salsa Cubana Nivel 1"
                className={styles.input}
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
                placeholder="Describe el curso, objetivos, prerrequisitos, etc."
                className={styles.textarea}
              ></textarea>
            </div>
            
            <div className={styles.formGroup}>
              <label>Imagen del Curso</label>
              <ImageUploader 
                onImageUpload={handleImageUpload} 
                label="Imagen de portada" 
                className={styles.imageUploader}
              />
              <p className={styles.inputHelp}>Sube una imagen para tu curso (opcional)</p>
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Curso Público</span>
              </label>
              <p className={styles.inputHelp}>Los cursos públicos aparecerán en la lista de cursos disponibles</p>
            </div>
            
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Creando...' : 'Crear Curso'}
            </button>
            
            {debugInfo && (
              <div className={styles.debugInfo}>
                <details>
                  <summary>Información de depuración</summary>
                  <pre>{debugInfo}</pre>
                </details>
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
} 