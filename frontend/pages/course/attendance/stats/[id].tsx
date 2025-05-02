import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../../../styles/AttendanceStats.module.css';
import Link from 'next/link';

interface StudentStat {
  student: {
    id: string;
    name: string;
    email: string;
  };
  stats: {
    total: number;
    present: number;
    absent: number;
    attendanceRate: number;
  };
}

interface StatsData {
  course: {
    id: string;
    title: string;
  };
  totalClasses: number;
  students: StudentStat[];
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function AttendanceStatsPage() {
  const router = useRouter();
  const { id } = router.query; // id del curso
  const [stats, setStats] = useState<StatsData | null>(null);
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

    if (id) {
      fetchStats();
    }
  }, [id, router]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/attendance/stats/course/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStats(response.data);
    } catch (error) {
      console.error('Error al obtener estadísticas de asistencia:', error);
      setError('No se pudieron cargar las estadísticas de asistencia');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando estadísticas...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!stats) {
    return <div className={styles.noData}>No hay datos de asistencia disponibles para este curso.</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Estadísticas de Asistencia</h1>
        <h2 className={styles.courseTitle}>{stats.course.title}</h2>
        
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.label}>Clases totales:</span>
            <span className={styles.value}>{stats.totalClasses}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.label}>Estudiantes:</span>
            <span className={styles.value}>{stats.students.length}</span>
          </div>
        </div>
        
        <div className={styles.statsTable}>
          <div className={styles.tableHeader}>
            <div className={styles.studentCol}>Estudiante</div>
            <div className={styles.statsCol}>
              <div className={styles.statItem}>Clases</div>
              <div className={styles.statItem}>Presentes</div>
              <div className={styles.statItem}>Ausentes</div>
              <div className={styles.statItem}>Asistencia</div>
            </div>
          </div>
          
          <div className={styles.tableBody}>
            {stats.students.length > 0 ? (
              stats.students.map((student) => (
                <div key={student.student.id} className={styles.studentRow}>
                  <div className={styles.studentCol}>
                    <div className={styles.studentName}>{student.student.name}</div>
                    <div className={styles.studentEmail}>{student.student.email}</div>
                  </div>
                  <div className={styles.statsCol}>
                    <div className={styles.statItem}>{student.stats.total}</div>
                    <div className={styles.statItem}>{student.stats.present}</div>
                    <div className={styles.statItem}>{student.stats.absent}</div>
                    <div className={styles.statItem}>
                      <div className={styles.attendanceRate}>
                        <div 
                          className={styles.attendanceBar}
                          style={{
                            width: `${student.stats.attendanceRate}%`,
                            backgroundColor: getAttendanceColor(student.stats.attendanceRate)
                          }}
                        ></div>
                        <span>{student.stats.attendanceRate}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.noStudents}>
                No hay datos de asistencia disponibles para ningún estudiante.
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.actions}>
          <Link href={`/course/attendance/${id}`} className={styles.button}>
            Volver a Control de Asistencia
          </Link>
          <Link href={`/course/${id}`} className={styles.buttonSecondary}>
            Volver al Curso
          </Link>
        </div>
      </main>
    </div>
  );
}

function getAttendanceColor(rate: number): string {
  if (rate >= 90) return '#38a169'; // Verde para asistencia alta
  if (rate >= 75) return '#68d391'; // Verde claro
  if (rate >= 60) return '#ecc94b'; // Amarillo
  if (rate >= 40) return '#ed8936'; // Naranja
  return '#e53e3e'; // Rojo para asistencia baja
} 