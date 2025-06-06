import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/SchoolForm.module.css';
import ImageUploader from '../../components/ImageUploader';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
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
  const [schoolOwners, setSchoolOwners] = useState<User[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [administratives, setAdministratives] = useState<User[]>([]);
  const [selectedAdministratives, setSelectedAdministratives] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
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
      
      // Al crear una escuela como admin, super_admin se muestra un dropdown para seleccionar school_owner
      if (['super_admin', 'admin'].includes(decoded.role)) {
        fetchSchoolOwners(token);
      } else {
        // Si no es admin o super_admin, el creador será el school_owner
        setSelectedOwnerId(decoded.sub);
      }
      
      // Cargar profesores y administrativos para las listas de selección
      fetchUsersByRole(token, 'teacher');
      fetchUsersByRole(token, 'administrative');
      
    } catch (error) {
      console.error('Error decodificando token:', error);
      router.push('/login');
    }
  }, [router]);
  
  const fetchSchoolOwners = async (token: string) => {
    try {
      setLoadingUsers(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await axios.get(
        `${apiUrl}/api/users/by-role/school_owner`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setSchoolOwners(response.data);
      
      // Si hay school owners, seleccionar el primero por defecto
      if (response.data.length > 0) {
        setSelectedOwnerId(response.data[0]._id);
      }
    } catch (error) {
      console.error('Error al cargar school owners:', error);
      setError('No se pudieron cargar los dueños de escuela');
    } finally {
      setLoadingUsers(false);
    }
  };
  
  const fetchUsersByRole = async (token: string, role: string) => {
    try {
      setLoadingUsers(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await axios.get(
        `${apiUrl}/api/users/by-role/${role}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (role === 'teacher') {
        setTeachers(response.data);
      } else if (role === 'administrative') {
        setAdministratives(response.data);
      }
    } catch (error) {
      console.error(`Error al cargar usuarios con rol ${role}:`, error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleImageUpload = (imageUrl: string) => {
    setLogoUrl(imageUrl);
  };
  
  const handleTeacherSelection = (teacherId: string) => {
    setSelectedTeachers(prev => {
      // Si ya está seleccionado, lo quitamos
      if (prev.includes(teacherId)) {
        return prev.filter(id => id !== teacherId);
      }
      // Si no está seleccionado, lo añadimos
      return [...prev, teacherId];
    });
  };
  
  const handleAdministrativeSelection = (adminId: string) => {
    setSelectedAdministratives(prev => {
      // Si ya está seleccionado, lo quitamos
      if (prev.includes(adminId)) {
        return prev.filter(id => id !== adminId);
      }
      // Si no está seleccionado, lo añadimos
      return [...prev, adminId];
    });
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
    
    // Validar que se haya seleccionado un school owner
    if (!selectedOwnerId) {
      setError('Debes seleccionar un dueño de escuela');
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
        logoUrl: logoUrl || undefined, 
        isPublic,
        admin: selectedOwnerId,
        teachers: selectedTeachers.length ? selectedTeachers : undefined,
        administratives: selectedAdministratives.length ? selectedAdministratives : undefined,
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

  if (loadingUsers) {
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
            
            {/* Mensaje para super_admin */}
            {userRole === 'super_admin' && (
              <div className={styles.adminInfo} style={{
                background: '#e3f2fd',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <p style={{ margin: 0 }}>
                  <strong>Modo Super Admin:</strong> Tienes privilegios para crear cualquier tipo de escuela.
                </p>
              </div>
            )}
            
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
            
            {/* Selección de School Owner (solo para admin y super_admin) */}
            {['super_admin', 'admin'].includes(userRole) && (
              <div className={styles.formGroup}>
                <label htmlFor="ownerId">Dueño de la Escuela*</label>
                <select
                  id="ownerId"
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  required
                  className={styles.select}
                >
                  <option value="">Seleccionar un dueño</option>
                  {schoolOwners.map((owner) => (
                    <option key={owner._id} value={owner._id}>
                      {owner.name} ({owner.email})
                    </option>
                  ))}
                </select>
                <p className={styles.inputHelp}>El usuario que será dueño y administrador principal de la escuela</p>
              </div>
            )}
            
            {/* Selección de Profesores */}
            <div className={styles.formGroup}>
              <label>Profesores</label>
              <div className={styles.multiSelect}>
                {teachers.length === 0 ? (
                  <p className={styles.inputHelp}>No hay profesores disponibles</p>
                ) : (
                  teachers.map((teacher) => (
                    <div key={teacher._id} className={styles.checkboxItem}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedTeachers.includes(teacher._id)}
                          onChange={() => handleTeacherSelection(teacher._id)}
                        />
                        <span>{teacher.name} ({teacher.email})</span>
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className={styles.inputHelp}>Selecciona los profesores que pertenecerán a esta escuela</p>
            </div>
            
            {/* Selección de Administrativos */}
            <div className={styles.formGroup}>
              <label>Personal Administrativo</label>
              <div className={styles.multiSelect}>
                {administratives.length === 0 ? (
                  <p className={styles.inputHelp}>No hay personal administrativo disponible</p>
                ) : (
                  administratives.map((admin) => (
                    <div key={admin._id} className={styles.checkboxItem}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedAdministratives.includes(admin._id)}
                          onChange={() => handleAdministrativeSelection(admin._id)}
                        />
                        <span>{admin.name} ({admin.email})</span>
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className={styles.inputHelp}>Selecciona el personal administrativo que pertenecerá a esta escuela</p>
            </div>
            
            <div className={styles.formGroup}>
              <label>Logo de la Escuela</label>
              <ImageUploader 
                onImageUpload={handleImageUpload} 
                label="Logo" 
                className={styles.imageUploader}
              />
              <p className={styles.inputHelp}>Sube una imagen para tu escuela (opcional)</p>
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