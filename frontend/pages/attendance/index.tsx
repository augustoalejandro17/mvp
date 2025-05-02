import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import Link from 'next/link';
import styles from '../../styles/AttendancePage.module.css';
import Layout from '../../components/Layout';

interface Course {
  _id: string;
  title: string;
  school: {
    _id: string;
    name: string;
  };
  students: string[];
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<DecodedToken | null>(null);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setCurrentUser(decoded);
      
      // Solo los profesores y administradores pueden acceder a esta página
      if (decoded.role !== 'teacher' && decoded.role !== 'admin' && decoded.role !== 'school_owner' && decoded.role !== 'super_admin') {
        router.push('/');
        return;
      }
    } catch (error) {
      console.error('Error al decodificar token:', error);
      router.push('/login');
      return;
    }

    fetchCourses();
  }, [router]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filtrar cursos según el rol del usuario
      let filteredCourses = response.data;
      
      if (currentUser?.role === 'teacher') {
        // Si es profesor, solo mostrar los cursos que imparte
        filteredCourses = filteredCourses.filter((course: Course) => 
          course.teacher && course.teacher._id === currentUser.sub
        );
      }
      
      setCourses(filteredCourses);
    } catch (error) {
      console.error('Error al obtener los cursos:', error);
      setError('No se pudieron cargar los cursos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Control de Asistencia | Dance Platform">
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Control de Asistencia</h1>
          <p className={styles.description}>
            Selecciona un curso para gestionar la asistencia de los estudiantes.
          </p>
          
          {error && <div className={styles.error}>{error}</div>}
          
          {loading ? (
            <div className={styles.loading}>Cargando cursos...</div>
          ) : (
            <div className={styles.grid}>
              {courses.length > 0 ? (
                courses.map((course) => (
                  <Link key={course._id} href={`/course/attendance/${course._id}`} className={styles.card}>
                    <h2>{course.title}</h2>
                    <p className={styles.schoolName}>{course.school?.name || 'Sin escuela asignada'}</p>
                    <p className={styles.courseStats}>
                      <span className={styles.studentsCount}>
                        {course.students?.length || 0} estudiantes
                      </span>
                    </p>
                    <div className={styles.cardFooter}>
                      <span className={styles.cardAction}>
                        Gestionar asistencia →
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className={styles.noCourses}>
                  <p>No tienes cursos disponibles para controlar asistencia.</p>
                  {currentUser?.role === 'admin' && (
                    <Link href="/course/create" className={styles.createButton}>
                      Crear un nuevo curso
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
} 