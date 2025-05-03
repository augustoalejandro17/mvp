import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import Link from 'next/link';
import styles from '../../styles/Admin.module.css';
import Layout from '../../components/Layout';
import { FaCalendarAlt, FaUsers, FaChalkboardTeacher, FaSchool, FaSearch } from 'react-icons/fa';

interface Course {
  _id: string;
  title: string;
  school: {
    _id: string;
    name: string;
  };
  students: string[];
  teacher?: {
    _id: string;
    name: string;
  };
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
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredCourses = searchTerm 
    ? courses.filter(course => 
        course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.school && course.school.name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : courses;

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Control de Asistencia</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <div className={styles.controls}>
          <div className={styles.search}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar cursos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FaSearch className={styles.searchIcon} />
          </div>
        </div>
        
        {loading ? (
          <div className={styles.loading}>Cargando cursos...</div>
        ) : (
          <>
            {filteredCourses.length > 0 ? (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Curso</th>
                      <th>Escuela</th>
                      <th>Estudiantes</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((course) => (
                      <tr key={course._id}>
                        <td>{course.title}</td>
                        <td>{course.school?.name || 'Sin escuela asignada'}</td>
                        <td>
                          <div className={styles.countBadge}>
                            <FaUsers className={styles.iconSpacer} />
                            {course.students?.length || 0} estudiantes
                          </div>
                        </td>
                        <td>
                          <div className={styles.actionButtons}>
                            <Link href={`/course/attendance/${course._id}`} className={styles.iconButton}>
                              <FaCalendarAlt /> Asistencia
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.emptyMessage}>
                {searchTerm ? (
                  <p>No se encontraron cursos que coincidan con su búsqueda.</p>
                ) : (
                  <>
                    <p>No tienes cursos disponibles para controlar asistencia.</p>
                    {currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'school_owner' ? (
                      <div className={styles.centerButtons}>
                        <Link href="/course/create" className={styles.createButton}>
                          Crear un nuevo curso
                        </Link>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
} 