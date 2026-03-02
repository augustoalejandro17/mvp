import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import CourseScheduleManager from '../../../components/CourseScheduleManager';
import { getToken } from '../../../utils/auth';
import styles from '../../../styles/CourseForm.module.css';

interface Course {
  _id: string;
  title: string;
  description: string;
  teacher: {
    _id: string;
    name: string;
  };
  teachers: Array<{
    _id: string;
    name: string;
  }>;
}

export default function CourseSchedulePage() {
  const router = useRouter();
  const { id } = router.query;
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (id) {
      fetchCourse();
    }
  }, [id]);

  const fetchCourse = async () => {
    try {
      const token = getToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/courses/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Error al cargar el curso');
      }

      const courseData = await response.json();
      setCourse(courseData);
    } catch (error) {
      console.error('Error fetching course:', error);
      setError('Error al cargar el curso');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.loading}>Cargando...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.error}>{error}</div>
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className={styles.container}>
          <div className={styles.error}>Curso no encontrado</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <button 
            className={styles.backButton}
            onClick={() => router.push(`/course/${id}`)}
          >
            ← Volver al Curso
          </button>
          <h1>Horario de {course.title}</h1>
          <p>Configura los días y horarios de tus clases para recibir notificaciones automáticas.</p>
        </div>

        <CourseScheduleManager 
          courseId={id as string}
        />
      </div>
    </Layout>
  );
} 