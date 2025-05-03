import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { jwtDecode } from 'jwt-decode';
import styles from '../../../styles/CreateClass.module.css';
import axios from 'axios';
import { useApiErrorHandler } from '../../../utils/api-error-handler';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function EditClass() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classData, setClassData] = useState<any>(null);
  const [courseId, setCourseId] = useState('');
  const { handleApiError } = useApiErrorHandler();

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const normalizedRole = String(decoded.role).toLowerCase();
      const hasPermission = normalizedRole === 'admin' || 
                          normalizedRole === 'teacher' || 
                          normalizedRole === 'super_admin' ||
                          normalizedRole === 'school_owner' ||
                          normalizedRole === 'administrative';
      
      if (!hasPermission) {
        router.push('/dashboard');
        return;
      }
    } catch (error) {
      console.error('Error decodificando token:', error);
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!id) return;
    
    // Fetch class data to get courseId
    const fetchClassData = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const token = Cookies.get('token');
        
        const headers = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
        
        const response = await axios.get(`${apiUrl}/api/classes/${id}`, { headers });
        setClassData(response.data);
        setCourseId(response.data.courseId || response.data.course?._id);
      } catch (error) {
        console.error('Error al obtener datos de la clase:', error);
        setError(handleApiError(error));
      } finally {
        setLoading(false);
      }
    };
    
    fetchClassData();
  }, [id]);

  const handleRedirectToCourse = () => {
    if (courseId) {
      router.push(`/course/${courseId}`);
    } else {
      router.push('/');
    }
  };

  if (loading) {
    return <div className={styles.loadingContainer}>Cargando datos de la clase...</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.error}>{error}</div>
          <button 
            onClick={() => router.back()} 
            className={styles.cancelButton}
          >
            Volver
          </button>
        </main>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.error}>No se encontró la clase solicitada</div>
          <button 
            onClick={() => router.back()} 
            className={styles.cancelButton}
          >
            Volver
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Editar Clase</h1>
        
        <div className={styles.infoContainer}>
          <h2>Estamos mejorando esta funcionalidad</h2>
          <div className={styles.classInfo}>
            <p><strong>Título:</strong> {classData.title}</p>
            <p><strong>Descripción:</strong> {classData.description}</p>
            {classData.videoUrl && (
              <div className={styles.videoPreview}>
                <p><strong>Video actual:</strong></p>
                <video 
                  src={classData.videoUrl} 
                  controls 
                  style={{ 
                    width: '100%', 
                    maxHeight: '300px',
                    objectFit: 'contain',
                    backgroundColor: '#000'
                  }} 
                />
              </div>
            )}
          </div>
          
          <div className={styles.messageBox}>
            <p>La funcionalidad de edición de clases está en desarrollo.</p>
            <p>Pronto podrás editar todos los aspectos de tus clases, incluyendo el título, descripción y video.</p>
          </div>
          
          <div className={styles.formActions}>
            <button 
              onClick={handleRedirectToCourse}
              className={styles.submitButton}
            >
              Volver al Curso
            </button>
          </div>
        </div>
      </main>
    </div>
  );
} 