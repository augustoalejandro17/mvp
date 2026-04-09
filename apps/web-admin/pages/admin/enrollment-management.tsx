import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [hasSearchedStudents, setHasSearchedStudents] = useState(false);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const { handleApiError } = useApiErrorHandler();
  const selectedCourseRecord = useMemo(
    () => courses.find((course) => course._id === selectedCourse) || null,
    [courses, selectedCourse],
  );
  const selectedStudentRecord = useMemo(
    () => searchResults.find((student) => student._id === selectedStudent) || null,
    [searchResults, selectedStudent],
  );
  const enrolledStudentIds = useMemo(
    () => new Set(enrollments.map((enrollment) => enrollment.student._id)),
    [enrollments],
  );

  const fetchCourses = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCourses(response.data);
    } catch (error) {
      handleApiError(error, 'Error al cargar los cursos');
    }
  }, [handleApiError]);

  const fetchEnrollments = useCallback(async (courseId?: string) => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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
      
      if (
        decoded.role !== 'admin' &&
        decoded.role !== 'school_owner' &&
        decoded.role !== 'super_admin' &&
        decoded.role !== 'teacher' &&
        decoded.role !== 'administrative'
      ) {
        router.push('/');
        return;
      }

      fetchCourses();
      const initialCourseId =
        typeof router.query.courseId === 'string' ? router.query.courseId : '';

      if (initialCourseId) {
        setSelectedCourse(initialCourseId);
        fetchEnrollments(initialCourseId);
      } else {
        fetchEnrollments();
      }
    } catch (error) {
      console.error('Error al decodificar token:', error);
      router.push('/login');
    }
  }, [router, router.query.courseId, fetchCourses, fetchEnrollments]);

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    setSelectedStudent('');
    setStudentSearch('');
    setSearchResults([]);
    setHasSearchedStudents(false);
    
    if (courseId) {
      fetchEnrollments(courseId);
    } else {
      fetchEnrollments();
    }
  };

  const handleSearchStudents = async () => {
    const query = studentSearch.trim();
    if (!selectedCourseRecord?.school?._id) {
      setError('Selecciona primero un curso para buscar estudiantes.');
      return;
    }
    if (!query || query.length < 3) {
      setError('Escribe al menos 3 caracteres del email para buscar.');
      return;
    }

    try {
      setIsSearchingStudents(true);
      setHasSearchedStudents(true);
      setError('');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      const response = await axios.get(`${apiUrl}/api/users/search-by-email`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          email: query,
          schoolId: selectedCourseRecord.school._id,
        },
      });

      const items = Array.isArray(response.data) ? response.data : [];
      setSearchResults(
        items.filter((candidate) => String(candidate.role || '').toLowerCase() !== 'unregistered'),
      );
    } catch (searchError) {
      setSearchResults([]);
      handleApiError(searchError, 'No se pudo buscar estudiantes');
    } finally {
      setIsSearchingStudents(false);
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
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      await axios.post(`${apiUrl}/api/courses/${selectedCourse}/enroll`, 
        { studentId: selectedStudent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Estudiante inscrito correctamente');
      setSelectedStudent('');
      setStudentSearch('');
      setSearchResults([]);
      setHasSearchedStudents(false);
      
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
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
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
                onChange={(e) => handleCourseChange(e.target.value)}
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
                  onChange={(e) => handleCourseChange(e.target.value)}
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
                <label htmlFor="studentSearch">Estudiante:</label>
                <div className={styles.searchBox}>
                  <input
                    id="studentSearch"
                    type="search"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      if (!e.target.value.trim()) {
                        setSearchResults([]);
                        setHasSearchedStudents(false);
                        setSelectedStudent('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSearchStudents();
                      }
                    }}
                    placeholder="Busca un estudiante por email..."
                    className={styles.searchInput}
                  />
                  <button
                    type="button"
                    className={styles.searchButton}
                    onClick={() => void handleSearchStudents()}
                    disabled={isSearchingStudents}
                  >
                    {isSearchingStudents ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                <p className={styles.helperText}>
                  Búsqueda global por email, igual que en mobile.
                </p>

                {selectedStudentRecord && (
                  <div className={styles.selectedStudentCard}>
                    <strong>{selectedStudentRecord.name}</strong>
                    <span>{selectedStudentRecord.email}</span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className={styles.searchResults}>
                    {[...searchResults]
                      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                      .map((student) => {
                        const alreadyEnrolled = enrolledStudentIds.has(student._id);
                        const isSelected = selectedStudent === student._id;

                        return (
                          <button
                            key={student._id}
                            type="button"
                            className={`${styles.searchResultItem} ${isSelected ? styles.searchResultItemActive : ''}`}
                            onClick={() => {
                              if (!alreadyEnrolled) {
                                setSelectedStudent(student._id);
                              }
                            }}
                            disabled={alreadyEnrolled}
                          >
                            <div className={styles.searchResultInfo}>
                              <strong>{student.name}</strong>
                              <span>{student.email}</span>
                              <small>{student.role}</small>
                            </div>
                            {alreadyEnrolled ? (
                              <span className={styles.resultBadgeMuted}>Ya inscrito</span>
                            ) : isSelected ? (
                              <span className={styles.resultBadgeActive}>Seleccionado</span>
                            ) : (
                              <span className={styles.resultBadge}>Elegir</span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}

                {hasSearchedStudents && !isSearchingStudents && searchResults.length === 0 && (
                  <div className={styles.noSearchResults}>
                    No encontramos estudiantes registrados con ese email.
                  </div>
                )}
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
                  <div className={styles.tableCell} style={{ width: '50px', textAlign: 'center' }}>#</div>
                  <div className={styles.tableCell}>Estudiante</div>
                  <div className={styles.tableCell}>Curso</div>
                  <div className={styles.tableCell}>Estado de Pago</div>
                  <div className={styles.tableCell}>Última Fecha de Pago</div>
                  <div className={styles.tableCell}>Acciones</div>
                </div>
                
                {[...enrollments]
                  .sort((a, b) => a.student.name.localeCompare(b.student.name, undefined, { sensitivity: 'base' }))
                  .map((enrollment, index) => (
                    <div key={enrollment._id} className={styles.tableRow}>
                      <div className={styles.tableCell} style={{ width: '50px', textAlign: 'center', fontWeight: 'bold' }}>
                        {index + 1}
                      </div>
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
