import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../../styles/Forms.module.css';

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

  useEffect(() => {
    // Verificar si hay un token
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Asegurarse de que id sea un string válido
    if (id && typeof id === 'string') {
      fetchSchool(id, token);
    }
  }, [id, router]);

  const fetchSchool = async (schoolId: string, token: string) => {
    setLoading(true);
    setError('');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(
        `${apiUrl}/api/schools/${schoolId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const schoolData = response.data;
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const schoolData = {
        name,
        description,
        logoUrl: logoUrl || undefined,
        address: address || undefined,
        phone: phone || undefined,
        website: website || undefined,
        isPublic
      };
      
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
      
      setSuccess('¡Escuela actualizada con éxito!');
      
      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push(`/school/${id}`);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error al actualizar escuela:', error);
      
      if (error.response) {
        // Error con respuesta del servidor
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
            <label htmlFor="logoUrl">URL del Logo</label>
            <input
              type="url"
              id="logoUrl"
              className={styles.input}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://ejemplo.com/imagen.jpg"
            />
            <small className={styles.inputHelp}>Ingresa la URL de una imagen para el logo (opcional)</small>
          </div>
          
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
            
            <div className={styles.formGroup}>
              <label htmlFor="website">Sitio Web</label>
              <input
                type="url"
                id="website"
                className={styles.input}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://ejemplo.com"
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