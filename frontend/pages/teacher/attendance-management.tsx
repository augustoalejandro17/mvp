import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/AttendanceManagement.module.css';
import Layout from '../../components/Layout';
import { useApiErrorHandler } from '../../utils/api-error-handler';
import Link from 'next/link';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaUserCheck, FaUserTimes, FaCalendarAlt, FaBook, FaChalkboardTeacher, FaSearch, FaSave } from 'react-icons/fa';

interface Student {
  _id: string;
  name: string;
  email: string;
}

interface Course {
  _id: string;
  title: string;
  school: {
    _id: string;
    name: string;
  };
  students: Student[];
}

interface Class {
  _id: string;
  title: string;
  date: string;
  courseId: string;
}

interface Attendance {
  _id?: string;
  studentId: string;
  present: boolean | null;
  notes?: string;
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function AttendanceManagementPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<DecodedToken | null>(null);
  const { handleApiError } = useApiErrorHandler();

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/courses/teaching`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCourses(response.data);
      if (response.data.length > 0 && !selectedCourse) {
        setSelectedCourse(response.data[0]._id);
      }
    } catch (error) {
      const errorMsg = handleApiError(error);
      setError(errorMsg || 'Error al cargar los cursos');
    } finally {
      setLoading(false);
    }
  }, [handleApiError, selectedCourse]);

  const fetchClasses = useCallback(async (courseId: string) => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/classes?courseId=${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setClasses(response.data);
      if (response.data.length > 0 && !selectedClass) {
        setSelectedClass(response.data[0]._id);
      }
    } catch (error) {
      const errorMsg = handleApiError(error);
      setError(errorMsg || 'Error al cargar las clases');
    } finally {
      setLoading(false);
    }
  }, [handleApiError, selectedClass]);

  const fetchAttendances = useCallback(async (classId: string) => {
    if (!classId) return;
    
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/classes/${classId}/attendance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Si hay registros de asistencia, mapearlos
      if (response.data && Array.isArray(response.data)) {
        setAttendances(response.data.map(attendance => ({
          _id: attendance._id,
          studentId: attendance.student._id,
          present: attendance.present,
          notes: attendance.notes
        })));
      } else {
        setAttendances([]);
      }
    } catch (error) {
      console.error('Error al obtener las asistencias:', error);
      // Si no hay asistencias para esta clase, inicializar array vacío
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [router, fetchCourses]);

  useEffect(() => {
    if (selectedCourse) {
      fetchClasses(selectedCourse);
    }
  }, [selectedCourse, fetchClasses]);

  useEffect(() => {
    if (selectedClass) {
      fetchAttendances(selectedClass);
    }
  }, [selectedClass, fetchAttendances]);

  const initializeAttendances = useCallback(() => {
    if (!selectedCourse) return;
    
    const selectedCourseObj = courses.find(course => course._id === selectedCourse);
    if (!selectedCourseObj || !selectedCourseObj.students) return;
    
    // Crear un registro de asistencia para cada estudiante que no tenga uno
    const newAttendances = [...attendances];
    
    selectedCourseObj.students.forEach(student => {
      const exists = attendances.some(a => a.studentId === student._id);
      if (!exists) {
        newAttendances.push({
          studentId: student._id,
          present: null,
          notes: ''
        });
      }
    });
    
    setAttendances(newAttendances);
  }, [selectedCourse, courses, attendances]);

  // Inicializar asistencias si se carga la clase y no hay asistencias
  useEffect(() => {
    if (selectedCourse && selectedClass && attendances.length === 0) {
      initializeAttendances();
    }
  }, [selectedCourse, selectedClass, attendances, initializeAttendances]);

  const handlePresentChange = (studentId: string, present: boolean) => {
    setAttendances(prev => 
      prev.map(attendance => 
        attendance.studentId === studentId 
          ? { ...attendance, present } 
          : attendance
      )
    );
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendances(prev => 
      prev.map(attendance => 
        attendance.studentId === studentId 
          ? { ...attendance, notes } 
          : attendance
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClass) {
      setError('Debes seleccionar una clase');
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Convertir registros sin selección a 'ausente' (present: false)
      const processedRecords = attendances.map(a => ({
        ...a,
        present: a.present === null ? false : a.present
      }));
      
      // Preparar los datos de asistencia
      const attendanceData = {
        date: new Date(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')),
        attendanceRecords: processedRecords.map(a => ({
          studentId: a.studentId,
          present: a.present,
          notes: a.notes || ''
        }))
      };
      
      await axios.post(`${apiUrl}/api/classes/${selectedClass}/attendance`, attendanceData, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSuccess('Asistencia registrada correctamente');
      
      // Actualizar la lista de asistencias
      fetchAttendances(selectedClass);
    } catch (error) {
      const errorMsg = handleApiError(error);
      setError(errorMsg || 'Error al guardar los datos de asistencia');
    } finally {
      setSaving(false);
    }
  };

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = e.target.value;
    setSelectedCourse(courseId);
    setSelectedClass('');
    setAttendances([]);
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const classId = e.target.value;
    setSelectedClass(classId);
    setAttendances([]);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      setSelectedDate(dateValue);
    } else {
      setSelectedDate(new Date().toISOString().split('T')[0]);
    }
  };

  // Obtener el curso seleccionado para acceder a sus estudiantes
  const selectedCourseObj = courses.find(course => course._id === selectedCourse);

  // Obtener la clase seleccionada
  const selectedClassObj = classes.find(classItem => classItem._id === selectedClass);

  return (
    <Layout title="Control de Asistencia | Dance Platform">
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Control de Asistencia</h1>
            {selectedCourseObj && (
              <div className={styles.courseInfo}>
                <FaChalkboardTeacher style={{ marginRight: '6px' }} />
                <span>{selectedCourseObj.title}</span>
              </div>
            )}
          </div>
          
          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}
          
          <div className={styles.controls}>
            <div className={styles.selectGroup}>
              <label htmlFor="courseSelect">
                <FaBook style={{ marginRight: '6px' }} />
                Curso:
              </label>
              <select
                id="courseSelect"
                value={selectedCourse}
                onChange={handleCourseChange}
                className={styles.select}
                disabled={loading}
              >
                <option value="">Seleccionar curso</option>
                {courses.map(course => (
                  <option key={course._id} value={course._id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>
            
            <div className={styles.selectGroup}>
              <label htmlFor="classSelect">
                <FaChalkboardTeacher style={{ marginRight: '6px' }} />
                Clase:
              </label>
              <select
                id="classSelect"
                value={selectedClass}
                onChange={handleClassChange}
                className={styles.select}
                disabled={loading || !selectedCourse}
              >
                <option value="">Seleccionar clase</option>
                {classes.map(classItem => (
                  <option key={classItem._id} value={classItem._id}>
                    {classItem.title} - {new Date(classItem.date).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                  </option>
                ))}
              </select>
            </div>
            
            <div className={styles.selectGroup}>
              <label htmlFor="date">
                <FaCalendarAlt style={{ marginRight: '6px' }} />
                Fecha:
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={handleDateChange}
                className={styles.dateInput}
              />
            </div>
          </div>
          
          {loading ? (
            <div className={styles.loading}>Cargando datos...</div>
          ) : selectedCourse && selectedClass && selectedCourseObj ? (
            <form onSubmit={handleSubmit} className={styles.attendanceForm}>
              {selectedClassObj && (
                <div className={styles.classInfo}>
                  <h2>
                    <FaChalkboardTeacher style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    {selectedClassObj.title}
                  </h2>
                  <p>
                    <FaCalendarAlt style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Fecha: {new Date(selectedClassObj.date).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                  </p>
                </div>
              )}
              
              <div className={styles.attendanceTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.countColumn}>#</div>
                  <div className={styles.studentColumn}>Estudiante</div>
                  <div className={styles.presentColumn}>Asistencia</div>
                  <div className={styles.notesColumn}>Notas</div>
                </div>
                
                <div className={styles.tableBody}>
                  {selectedCourseObj.students && selectedCourseObj.students.length > 0 ? (
                    // Sort students alphabetically by name
                    [...selectedCourseObj.students]
                      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                      .map((student, index) => {
                        const attendance = attendances.find(a => a.studentId === student._id) || {
                          studentId: student._id,
                          present: null,
                          notes: ''
                        };
                        
                        return (
                          <div key={student._id} className={styles.tableRow}>
                            <div className={styles.countColumn}>{index + 1}</div>
                            <div className={styles.studentColumn}>
                              <div className={styles.studentName}>{student.name}</div>
                              <div className={styles.studentEmail}>{student.email}</div>
                            </div>
                            
                            <div className={styles.presentColumn}>
                              <div className={styles.radioGroup}>
                                <label className={styles.radioLabel}>
                                  <input
                                    type="radio"
                                    name={`present-${student._id}`}
                                    checked={attendance.present === true}
                                    onChange={() => handlePresentChange(student._id, true)}
                                    className={styles.radioInput}
                                  />
                                  <FaUserCheck style={{ marginRight: '4px', color: '#38a169' }} />
                                  Presente
                                </label>
                                <label className={styles.radioLabel}>
                                  <input
                                    type="radio"
                                    name={`present-${student._id}`}
                                    checked={attendance.present === false}
                                    onChange={() => handlePresentChange(student._id, false)}
                                    className={styles.radioInput}
                                  />
                                  <FaUserTimes style={{ marginRight: '4px', color: '#e53e3e' }} />
                                  Ausente
                                </label>
                              </div>
                            </div>
                            
                            <div className={styles.notesColumn}>
                              <input
                                type="text"
                                value={attendance.notes || ''}
                                onChange={(e) => handleNotesChange(student._id, e.target.value)}
                                placeholder="Agregar notas (opcional)"
                                className={styles.notesInput}
                              />
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className={styles.noStudents}>
                      No hay estudiantes inscritos en este curso.
                    </div>
                  )}
                </div>
              </div>
              
              {selectedCourseObj.students && selectedCourseObj.students.length > 0 && (
                <div className={styles.formActions}>
                  <button
                    type="submit"
                    className={styles.saveButton}
                    disabled={saving}
                  >
                    <FaSave style={{ marginRight: '8px' }} />
                    {saving ? 'Guardando...' : 'Guardar Asistencia'}
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className={styles.instructions}>
              <p>Selecciona un curso y una clase para gestionar la asistencia.</p>
              {selectedCourse && classes.length === 0 && (
                <p>No hay clases disponibles para este curso. <Link href={`/course/${selectedCourse}`}>Ver detalles del curso</Link></p>
              )}
            </div>
          )}
          
          {selectedCourse && (
            <div className={styles.actions}>
              <Link href={`/course/${selectedCourse}`}>
                Volver al Curso
              </Link>
              {selectedCourse && (
                <Link href={`/course/attendance/stats/${selectedCourse}`}>
                  Ver Estadísticas de Asistencia
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
} 