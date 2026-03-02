import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../../styles/SchoolForm.module.css';
import ImageUploader from '../../../components/ImageUploader';
import SchoolLogoPreview from '../../../components/SchoolLogoPreview';
import SchoolOwnerManagement from '../../../components/SchoolOwnerManagement';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface School {
  _id: string;
  name: string;
  description: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  website?: string;
  isPublic: boolean;
}

export default function EditSchool() {
  const router = useRouter();
  const { id } = router.query;
  
  const [school, setSchool] = useState<School | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<DecodedToken | null>(null);
  const [pendingOwners, setPendingOwners] = useState<User[]>([]);

  const fetchSchool = useCallback(async (schoolId: string, token: string) => {
    setLoading(true);
    setError('');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await axios.get(
        `${apiUrl}/api/schools/${schoolId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const schoolData = response.data;
      
      // Verificar si el usuario tiene permisos para editar la escuela
      let hasPermission = false;
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        const userId = decoded.sub;
        const userRole = decoded.role;
        
        // Usuarios con rol 'super_admin', 'school_owner', 'admin' o el administrador de la escuela pueden editarla
        if (userRole === 'super_admin' || userRole === 'school_owner' || userRole === 'admin' || schoolData.admin?._id === userId) {
          hasPermission = true;
        }
      } catch (error) {
        console.error('Error al verificar permisos:', error);
      }
      
      if (!hasPermission) {
        // Redirigir a la página de detalles si no tiene permisos
        router.push(`/school/${schoolId}`);
        return;
      }
      
      setSchool(schoolData);
      
      // Llenar los campos del formulario
      setName(schoolData.name || '');
      setDescription(schoolData.description || '');
      setLogoUrl(schoolData.logoUrl || '');
      setAddress(schoolData.address || '');
      setPhone(schoolData.phone || '');
      setWebsite(schoolData.website || '');
      setIsPublic(schoolData.isPublic || false);
      
    } catch (error: any) {
      console.error('Error al obtener escuela:', error);
      setError('Error al cargar los datos de la escuela. Verifica tu permiso o conexión.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Decode token to get current user info
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setCurrentUser(decoded);
    } catch (error) {
      console.error('Error decoding token:', error);
      router.push('/login');
      return;
    }

    // Asegurarse de que id sea un string válido
    if (id && typeof id === 'string') {
      fetchSchool(id, token);
    }
  }, [id, router, fetchSchool]);

  const handleImageUpload = (imageUrl: string) => {
    
    // Almacenar la URL sin parámetros de caché para facilitar la comparación
    const cleanUrl = imageUrl.split('?')[0];
    
    setLogoUrl(imageUrl);
  };

  const saveSchoolOwners = async (owners: User[]) => {
    const token = Cookies.get('token');
    if (!token || !id) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    try {
      // For each owner, assign them the school_owner role
      for (const owner of owners) {
        await axios.post(
          `${apiUrl}/api/users/${owner._id}/assign-role-in-school`,
          {
            schoolId: id,
            role: 'school_owner'
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
    } catch (error) {
      console.error('Error saving school owners:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación
    if (!name.trim() || !description.trim()) {
      setError('El nombre y la descripción son obligatorios');
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const schoolData = {
        name,
        description,
        logoUrl: logoUrl || null,
        address: address || undefined,
        phone: phone || undefined,
        website: website || undefined,
        isPublic
      };
      
      // Log para depuración
      
      
      
      
      
      
      
      const response = await axios.put(
        `${apiUrl}/api/schools/${id}`,
        schoolData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Save school owners if there are pending changes
      if (pendingOwners.length > 0) {
        await saveSchoolOwners(pendingOwners);
      }

      setSuccess('¡Escuela actualizada con éxito!');
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push(`/school/${id}`);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error al actualizar escuela:', error);
      
      if (error.response) {
        // Error con respuesta del servidor
        console.error('Status:', error.response.status);
        console.error('Headers:', JSON.stringify(error.response.headers));
        console.error('Data:', JSON.stringify(error.response.data));
        
        // Verificar detalles específicos del error 403
        if (error.response.status === 403) {
          // Intenta decodificar el token para ver si es válido y su contenido
          try {
            if (token) {
              const decoded = jwtDecode<DecodedToken>(token);
              console.error('Token decodificado:', {
                sub: decoded.sub,
                role: decoded.role,
                email: decoded.email,
                name: decoded.name
              });
            }
          } catch (tokenError) {
            console.error('Error al decodificar token:', tokenError);
          }
        }
        
        const errorMessage = error.response.data.message || 'Error al actualizar la escuela';
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
      <div className={styles.loading}>Cargando información de la escuela...</div>
    </div>;
  }

  if (!school && !loading) {
    return <div className={styles.container}>
      <div className={styles.error}>No se pudo encontrar la escuela solicitada.</div>
      <div className={styles.buttonContainer}>
        <Link href="/admin" className={styles.secondaryButton}>Volver al panel de administración</Link>
      </div>
    </div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Editar Escuela</h1>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.error}><p>{error}</p></div>}
          {success && <div className={styles.success}><p>{success}</p></div>}
          
          <div className={styles.formGroup}>
            <label htmlFor="name">Nombre de la Escuela*</label>
            <input
              type="text"
              id="name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            <label>Logo de la Escuela</label>
            <ImageUploader 
              onImageUpload={handleImageUpload} 
              defaultImage={logoUrl}
              label="Logo" 
              className={styles.imageUploader}
            />
            <small className={styles.inputHelp}>Sube una imagen para el logo de tu escuela (opcional)</small>
            
            {/* Show preview if there's an image */}
            {logoUrl && (
              <SchoolLogoPreview
                imageUrl={logoUrl}
                schoolName={name || "Tu Escuela"}
                title="Vista previa del logo"
              />
            )}
          </div>

          {/* School Owner Management - Only visible to school owners */}
          {currentUser && 
           (currentUser.role === 'super_admin' || 
            currentUser.role === 'school_owner' || 
            currentUser.role === 'admin') && 
            id && typeof id === 'string' && (
            <SchoolOwnerManagement 
              schoolId={id}
              currentUserId={currentUser.sub}
              onOwnersChange={(owners) => setPendingOwners(owners)}
            />
          )}
          
          <div className={styles.formGroup}>
            <label htmlFor="address">Dirección</label>
            <input
              type="text"
              id="address"
              className={styles.input}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número, ciudad, país"
            />
          </div>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="phone">Teléfono</label>
              <input
                type="tel"
                id="phone"
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+00 123456789"
              />
            </div>
          </div>
          
          <div className={styles.formGroup}>
            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <label htmlFor="isPublic">Escuela pública (visible para todos)</label>
            </div>
            <small className={styles.inputHelp}>
              Si está marcado, la escuela será visible para todos los usuarios. De lo contrario, solo será visible para los miembros de la escuela.
            </small>
          </div>
          
          <div className={styles.buttonContainer}>
            <Link href={`/school/${id}`} className={styles.secondaryButton}>
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