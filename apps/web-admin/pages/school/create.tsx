import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/SchoolForm.module.css';
import ImageUploader from '../../components/ImageUploader';
import ImagePreviewHelper from '../../components/ImagePreviewHelper';

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
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [detectedTimezone, setDetectedTimezone] = useState<string>('');

  useEffect(() => {
    // Detect user's timezone automatically
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDetectedTimezone(timezone);
      console.log('Detected timezone:', timezone);
    } catch (error) {
      console.error('Error detecting timezone:', error);
      setDetectedTimezone('America/Bogota'); // Fallback to default
    }

    // Verificar autenticación
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      
      // Permitir a super_admin, admin y teacher crear escuelas
      if (!['super_admin', 'admin', 'teacher', 'school_owner'].includes(decoded.role)) {
        console.log('Usuario sin permisos suficientes:', decoded.role);
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

  const handleImageUpload = (imageUrl: string) => {
    setLogoUrl(imageUrl);
  };

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
    
    // Owner will be assigned later through user management
    
    try {
      setLoading(true);
      setError('');
      setDebugInfo(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');

      const payload = { 
        name, 
        description, 
        logoUrl: logoUrl || undefined, 
        isPublic,
        timezone: detectedTimezone || 'America/Bogota' // Include detected timezone
      };

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
      
      setSuccess(true);
      
      // Redirigir al listado de escuelas después de 2 segundos
      setTimeout(() => {
        router.push('/admin/schools');
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

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Crear Nueva Escuela</h1>
        
        {success ? (
          <div className={styles.successMessage}>
            <p>¡Escuela creada con éxito! Redirigiendo...</p>
            <p className={styles.inputHelp}>
              La escuela ha sido creada sin asignar usuarios. Podrás asignar el dueño, profesores y personal administrativo desde el módulo de usuarios.
            </p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {error && <p className={styles.error}>{error}</p>}
            
            {/* Privacy notice */}
            <div className={styles.adminInfo} style={{
              background: '#f0f9ff',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '20px',
              border: '1px solid #0ea5e9'
            }}>
              <p style={{ margin: 0 }}>
                <strong>🔒 Privacidad Mejorada:</strong> Ya no necesitas seleccionar usuarios al crear la escuela. 
                Podrás asignar el dueño, profesores y personal administrativo más tarde desde el módulo de usuarios.
              </p>
            </div>
            
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

            {/* Timezone Detection Info */}
            {detectedTimezone && (
              <div className={styles.formGroup} style={{
                background: '#f0f9ff',
                padding: '12px',
                borderRadius: '4px',
                border: '1px solid #0ea5e9'
              }}>
                <label style={{ color: '#0369a1', fontWeight: 'bold' }}>🌍 Zona Horaria Detectada</label>
                <p style={{ 
                  margin: '4px 0 0 0', 
                  color: '#0369a1', 
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}>
                  {detectedTimezone}
                </p>
                <p className={styles.inputHelp} style={{ color: '#0369a1' }}>
                  Esta zona horaria se asignará automáticamente a tu escuela para mostrar fechas y horarios correctamente.
                </p>
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label>Logo de la Escuela</label>
              <ImageUploader 
                onImageUpload={handleImageUpload} 
                label="Logo" 
                className={styles.imageUploader}
              />
              <p className={styles.inputHelp}>Sube una imagen para tu escuela (opcional)</p>
              
              {/* Show preview if there's an image */}
              {logoUrl && (
                <ImagePreviewHelper
                  imageUrl={logoUrl}
                  title="Vista previa del logo"
                />
              )}
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