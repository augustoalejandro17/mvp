import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../styles/Dashboard.module.css';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    // Verificar si hay un token
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Obtener información del usuario desde el token
    try {
      const decoded = parseJwt(token);
      console.log('Token decodificado:', decoded);
      
      setUser({
        id: decoded.sub,
        name: decoded.name || '',  // Si hay nombre en el token, úsalo
        email: decoded.email,
        role: decoded.role,
      });

      // Si no es profesor, redirigir
      if (decoded.role !== 'teacher') {
        router.push('/');
      }
      
      // Información de depuración
      setDebugInfo(`Token válido. Usuario ID: ${decoded.sub}, Rol: ${decoded.role}`);
    } catch (error) {
      console.error('Error al decodificar token:', error);
      setDebugInfo('Error al decodificar token');
      Cookies.remove('token');
      router.push('/login');
    }
  }, [router]);

  const parseJwt = (token: string) => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      console.error('Error parsing JWT:', e);
      return null;
    }
  };

  const validateYoutubeUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      
      // Verificar dominios de YouTube
      const youtubeHosts = [
        'youtube.com',
        'www.youtube.com',
        'youtu.be',
        'www.youtu.be'
      ];
      
      return youtubeHosts.some(host => hostname.endsWith(host));
    } catch (e) {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setDebugInfo('');
    
    // Validaciones adicionales en el cliente
    if (title.trim().length < 3) {
      setError('El título debe tener al menos 3 caracteres');
      setLoading(false);
      return;
    }
    
    if (description.trim().length < 10) {
      setError('La descripción debe tener al menos 10 caracteres');
      setLoading(false);
      return;
    }
    
    const trimmedVideoUrl = videoUrl.trim();
    if (!validateYoutubeUrl(trimmedVideoUrl)) {
      setError('Por favor, proporciona una URL de YouTube válida');
      setLoading(false);
      return;
    }

    try {
      const token = Cookies.get('token');
      if (!token) {
        setError('No hay token de autenticación');
        setLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      console.log('Enviando solicitud a:', `${apiUrl}/classes`);
      
      // Más información de depuración
      const data = { 
        title: title.trim(), 
        description: description.trim(), 
        videoUrl: trimmedVideoUrl
      };
      
      setDebugInfo(
        `Enviando solicitud a: ${apiUrl}/classes\n` +
        `Con token: ${token.substring(0, 15)}...\n` +
        `Datos: ${JSON.stringify(data, null, 2)}`
      );
      
      console.log('Datos a enviar:', data);
      
      const response = await axios.post(
        `${apiUrl}/classes`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        }
      );

      console.log('Respuesta recibida:', response);
      setSuccess('Clase creada con éxito');
      setDebugInfo((prev: string) => prev + `\n\nRespuesta: ${JSON.stringify(response.data, null, 2)}`);
      setTitle('');
      setDescription('');
      setVideoUrl('');
    } catch (error: any) {
      console.error('Error al crear clase:', error);
      
      // Información detallada del error para depuración
      if (error.response) {
        // La solicitud fue hecha y el servidor respondió con un código de estado fuera del rango 2xx
        console.error('Error de respuesta:', error.response.data);
        console.error('Status:', error.response.status);
        
        const errorData = error.response.data;
        const errorMessage = typeof errorData === 'object' 
          ? (errorData.message || JSON.stringify(errorData)) 
          : String(errorData);
        
        setDebugInfo(
          `Error ${error.response.status}\n` +
          `Headers: ${JSON.stringify(error.response.headers, null, 2)}\n` +
          `Datos: ${JSON.stringify(errorData, null, 2)}`
        );
        
        setError(`Error ${error.response.status}: ${errorMessage}`);
      } else if (error.request) {
        // La solicitud fue hecha pero no se recibió respuesta
        console.error('Error de solicitud:', error.request);
        setDebugInfo(`No se recibió respuesta del servidor\nRequest: ${JSON.stringify(error.request, null, 2)}`);
        setError('No se pudo conectar con el servidor. Verifica tu conexión.');
      } else {
        // Algo ocurrió al configurar la solicitud que desencadenó un error
        console.error('Error:', error.message);
        setDebugInfo(`Error: ${error.message}\nStack: ${error.stack}`);
        setError('Error al crear la clase. Por favor, intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Panel de Profesor</h1>
        <div className={styles.content}>
          <div className={styles.formContainer}>
            <h2>Crear Nueva Clase</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              {error && <p className={styles.error}>{error}</p>}
              {success && <p className={styles.success}>{success}</p>}
              <div className={styles.formGroup}>
                <label htmlFor="title">Título</label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className={styles.input}
                  minLength={3}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  className={styles.input}
                  minLength={10}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="videoUrl">URL del Video (YouTube)</label>
                <input
                  type="url"
                  id="videoUrl"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  className={styles.input}
                  pattern="https?://.*"
                />
                <small className={styles.inputHelp}>
                  Ejemplo: https://www.youtube.com/watch?v=abcdefghijk
                </small>
              </div>
              <button
                type="submit"
                className={styles.button}
                disabled={loading}
              >
                {loading ? 'Creando...' : 'Crear Clase'}
              </button>
            </form>
            
            {debugInfo && (
              <div className={styles.debugInfo}>
                <h3>Información de depuración</h3>
                <pre>{debugInfo}</pre>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 