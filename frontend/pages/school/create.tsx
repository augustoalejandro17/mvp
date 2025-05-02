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

export default function CreateSchool() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    // Verificar autenticación
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      console.log('Token decodificado:', decoded);
      if (decoded.role !== 'admin' && decoded.role !== 'teacher') {
        router.push('/');
        return;
      }
      setUserId(decoded.sub);
      setUserRole(decoded.role);
    } catch (error) {
      console.error('Error decodificando token:', error);
      router.push('/login');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (!name || !description) {
      setError('El nombre y descripción son obligatorios');
      return;
    }

    if (description.length < 10) {
      setError('La descripción debe tener al menos 10 caracteres');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setDebugInfo(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');

      const payload = { 
        name, 
        description, 
        logoUrl: logoUrl || 'https://via.placeholder.com/150?text=Escuela', 
        isPublic,
        admin: userId
      };
      
      console.log('Enviando petición a:', `${apiUrl}/api/schools`);
      console.log('Payload:', payload);
      console.log('Token:', token ? 'Presente' : 'No presente');

      const response = await axios.post(
        `${apiUrl}/api/schools`, 
        payload,
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          } 
        }
      );
      
      console.log('Respuesta del servidor:', response.data);
      setSuccess(true);
      
      // Redirigir al listado de escuelas después de 2 segundos
      setTimeout(() => {
        router.push('/');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error al crear escuela:', error);
      
      const errorDebug = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        }
      };
      
      setDebugInfo(errorDebug);
      
      if (error.response && error.response.data && error.response.data.message) {
        if (Array.isArray(error.response.data.message)) {
          setError(error.response.data.message.join(', '));
        } else {
          setError(error.response.data.message);
        }
      } else {
        setError('Error al crear la escuela. Por favor, intenta de nuevo más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return <div className={styles.loadingContainer}>Cargando...</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Crear Nueva Escuela</h1>
        
        {success ? (
          <div className={styles.successMessage}>
            <p>¡Escuela creada con éxito! Redirigiendo...</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {error && <p className={styles.error}>{error}</p>}
            
            <div className={styles.formGroup}>
              <label htmlFor="name">Nombre de la Escuela*</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ej: Academia de Danza Moderna"
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
                placeholder="Describe tu escuela de danza..."
                className={styles.textarea}
              ></textarea>
              <p className={styles.inputHelp}>Mínimo 10 caracteres</p>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="logoUrl">URL del Logo</label>
              <input
                type="url"
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className={styles.input}
              />
              <p className={styles.inputHelp}>Si no proporcionas una URL, se usará una imagen predeterminada</p>
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>Escuela Pública</span>
              </label>
              <p className={styles.inputHelp}>Las escuelas públicas son visibles para todos los usuarios</p>
            </div>
            
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? 'Creando...' : 'Crear Escuela'}
            </button>

            {debugInfo && (
              <div className={styles.debugInfo}>
                <h3>Información de Depuración</h3>
                <p>Estado: {debugInfo.status} {debugInfo.statusText}</p>
                <p>Mensaje: {debugInfo.message}</p>
                {debugInfo.data && (
                  <pre>{JSON.stringify(debugInfo.data, null, 2)}</pre>
                )}
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
} 