import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../styles/ClassDetail.module.css';
import { FaTrashAlt, FaEdit } from 'react-icons/fa';
import Link from 'next/link';
import VideoPlayer from '../../components/VideoPlayer';

interface Class {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  videoFileName?: string;
  teacher: {
    _id: string;
    name: string;
    email: string;
  };
  course: {
    _id: string;
    title: string;
  };
}

export default function ClassDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [classData, setClassData] = useState<Class | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      setUser({
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
      });
    } catch (error) {
      console.error('Error al decodificar token:', error);
    }

    if (id) {
      fetchClassData(token);
    }
  }, [id, router]);

  const fetchClassData = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(`${apiUrl}/api/classes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClassData(response.data);
    } catch (error) {
      console.error('Error al cargar la clase:', error);
      setError('Error al cargar la información de la clase');
    } finally {
      setLoading(false);
    }
  };

  const isTeacherOrAdmin = () => {
    if (!user || !classData) return false;
    
    if (user.role === 'admin') return true;
    
    return classData.teacher?._id === user.id;
  };

  const handleDeleteClass = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta clase? Esta acción no se puede deshacer.')) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      if (!token) {
        setError('Debes iniciar sesión para realizar esta acción');
        setIsDeleting(false);
        return;
      }
      
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      await axios.delete(`${apiUrl}/api/classes/${id}`, { headers });
      
      // Redirigir al curso después de eliminar
      if (classData?.course?._id) {
        router.push(`/course/${classData.course._id}`);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error al eliminar la clase:', error);
      setError('Error al eliminar la clase. Por favor intenta de nuevo.');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando clase...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!classData) {
    return <div className={styles.error}>No se encontró la clase</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>{classData.title}</h1>
        <div className={styles.content}>
          <div className={styles.videoContainer}>
            {classData.videoUrl ? (
              <VideoPlayer 
                videoUrl={classData.videoUrl}
                title={classData.title}
                poster="/video-placeholder.jpg"
                classId={id as string}
                onError={(e) => {
                  console.error('Error al cargar el video en Class Detail:', e);
                  console.log('URL problemática:', classData.videoUrl);
                }}
              />
            ) : (
              <div className={styles.noVideoMessage}>
                No hay video disponible para esta clase
              </div>
            )}
          </div>
          <div className={styles.details}>
            <h2>Descripción</h2>
            <p>{classData.description}</p>
            <h2>Profesor</h2>
            <p>{classData.teacher.name}</p>
            <p>{classData.teacher.email}</p>
            {classData.videoFileName && (
              <div className={styles.videoInfo}>
                <h2>Información del video</h2>
                <p>Nombre del archivo: {classData.videoFileName}</p>
              </div>
            )}
            
            {isTeacherOrAdmin() && (
              <div className={styles.adminActions}>
                <button 
                  className={`${styles.actionButton} ${styles.editButton}`}
                  onClick={() => router.push(`/class/edit/${classData._id}`)}
                >
                  <FaEdit /> Editar Clase
                </button>
                <button 
                  className={`${styles.actionButton} ${styles.deleteButton}`}
                  onClick={handleDeleteClass}
                  disabled={isDeleting}
                >
                  <FaTrashAlt /> {isDeleting ? 'Eliminando...' : 'Eliminar Clase'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.backLink}>
          {classData.course && (
            <Link href={`/course/${classData.course._id}`}>
              <a>← Volver al curso</a>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}