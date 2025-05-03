import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/EnrollmentManagement.module.css';
import Layout from '../../components/Layout';
import { useApiErrorHandler } from '../../utils/api-error-handler';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Course {
  _id: string;
  title: string;
  school: {
    _id: string;
    name: string;
  };
}

interface Enrollment {
  _id: string;
  student: User;
  course: Course;
  paymentStatus: boolean;
  lastPaymentDate?: string;
  paymentNotes?: string;
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function EnrollmentManagementPage() {
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const { handleApiError } = useApiErrorHandler();

  const fetchCourses = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCourses(response.data);
    } catch (error) {
      handleApiError(error, 'Error al cargar los cursos');
    }
  }, [handleApiError]);

  const fetchStudents = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/users?role=student`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStudents(response.data);
    } catch (error) {
      handleApiError(error, 'Error al cargar los estudiantes');
    }
  }, [handleApiError]);

  const fetchEnrollments = useCallback(async (courseId?: string) => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const url = courseId 
        ? `${apiUrl}/api/courses/${courseId}/enrollments` 
        : `${apiUrl}/api/enrollments`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setEnrollments(response.data);
    } catch (error) {
      handleApiError(error, 'Error al cargar las inscripciones');
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      
      // Solo los administradores pueden acceder a esta página
      if (decoded.role !== 'admin' && decoded.role !== 'school_owner' && decoded.role !== 'super_admin') {
        router.push('/');
        return;
      }

      fetchCourses();
      fetchStudents();
      fetchEnrollments();
    } catch (error) {
      console.error('Error al decodificar token:', error);
      router.push('/login');
    }
  }, [router, fetchCourses, fetchStudents, fetchEnrollments]);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = e.target.value;
    setSelectedCourse(courseId);
    
    if (courseId) {
      fetchEnrollments(courseId);
    } else {
      fetchEnrollments();
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCourse || !selectedStudent) {
      setError('Debes seleccionar un curso y un estudiante');
      return;
    }
    
    try {
      setIsEnrolling(true);
      setError('');
      setSuccess('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      await axios.post(`${apiUrl}/api/courses/${selectedCourse}/enroll`, 
        { studentId: selectedStudent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Estudiante inscrito correctamente');
      setSelectedStudent('');
      
      // Actualizar la lista de inscripciones
      fetchEnrollments(selectedCourse);
    } catch (error) {
      handleApiError(error, 'Error al inscribir al estudiante');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleUnenrollStudent = async (enrollmentId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta inscripción?')) {
      return;
    }
    
    try {
      setIsUnenrolling(true);
      setError('');
      setSuccess('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      await axios.delete(`${apiUrl}/api/enrollments/${enrollmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Inscripción eliminada correctamente');
      
      // Actualizar la lista de inscripciones
      fetchEnrollments(selectedCourse);
    } catch (error) {
      handleApiError(error, 'Error al eliminar la inscripción');
    } finally {
      setIsUnenrolling(false);
    }
  };

  return (
    <Layout title="Gestión de Inscripciones | Dance Platform">
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Gestión de Inscripciones</h1>
          
          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}
          
          <div className={styles.filterSection}>
            <div className={styles.filterItem}>
              <label htmlFor="courseFilter">Filtrar por curso:</label>
              <select
                id="courseFilter"
                value={selectedCourse}
                onChange={handleCourseChange}
                className={styles.select}
              >
                <option value="">Todos los cursos</option>
                {courses.map(course => (
                  <option key={course._id} value={course._id}>
                    {course.title} - {course.school?.name || 'Sin escuela'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className={styles.enrollSection}>
            <h2>Inscribir Estudiante</h2>
            <form onSubmit={handleEnrollStudent} className={styles.enrollForm}>
              <div className={styles.formGroup}>
                <label htmlFor="courseSelect">Curso:</label>
                <select
                  id="courseSelect"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">Selecciona un curso</option>
                  {courses.map(course => (
                    <option key={course._id} value={course._id}>
                      {course.title} - {course.school?.name || 'Sin escuela'}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="studentSelect">Estudiante:</label>
                <select
                  id="studentSelect"
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">Selecciona un estudiante</option>
                  {students.map(student => (
                    <option key={student._id} value={student._id}>
                      {student.name} - {student.email}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                type="submit"
                className={styles.enrollButton}
                disabled={isEnrolling}
              >
                {isEnrolling ? 'Inscribiendo...' : 'Inscribir'}
              </button>
            </form>
          </div>
          
          <div className={styles.enrollmentsSection}>
            <h2>Inscripciones Actuales</h2>
            
            {loading ? (
              <div className={styles.loading}>Cargando inscripciones...</div>
            ) : enrollments.length > 0 ? (
              <div className={styles.enrollmentsTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>Estudiante</div>
                  <div className={styles.tableCell}>Curso</div>
                  <div className={styles.tableCell}>Estado de Pago</div>
                  <div className={styles.tableCell}>Última Fecha de Pago</div>
                  <div className={styles.tableCell}>Acciones</div>
                </div>
                
                {enrollments.map(enrollment => (
                  <div key={enrollment._id} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <div>{enrollment.student.name}</div>
                      <div className={styles.emailText}>{enrollment.student.email}</div>
                    </div>
                    <div className={styles.tableCell}>
                      <div>{enrollment.course.title}</div>
                      <div className={styles.schoolText}>
                        {enrollment.course.school?.name || 'Sin escuela'}
                      </div>
                    </div>
                    <div className={styles.tableCell}>
                      <span className={
                        enrollment.paymentStatus 
                          ? styles.paymentStatusPaid 
                          : styles.paymentStatusUnpaid
                      }>
                        {enrollment.paymentStatus ? 'Pagado' : 'Pendiente'}
                      </span>
                    </div>
                    <div className={styles.tableCell}>
                      {enrollment.lastPaymentDate 
                        ? new Date(enrollment.lastPaymentDate).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'}) 
                        : 'No registrado'}
                    </div>
                    <div className={styles.tableCell}>
                      <button
                        onClick={() => handleUnenrollStudent(enrollment._id)}
                        className={styles.unenrollButton}
                        disabled={isUnenrolling}
                      >
                        {isUnenrolling ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noEnrollments}>
                No hay inscripciones{selectedCourse ? ' para este curso' : ''}. Inscribe a un estudiante usando el formulario de arriba.
              </div>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
} 