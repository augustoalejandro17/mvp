import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/IntegratedAttendance.module.css';
import Layout from '../../components/Layout';
import { useApiErrorHandler } from '../../utils/api-error-handler';
import { convertGMT5ToUTC, getUTCRangeForGMT5Date, getCurrentGMT5Date } from '../../utils/timezone-utils';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaUserCheck, FaUserTimes, FaCalendarAlt, FaBook, FaChalkboardTeacher, FaCreditCard, FaSave, FaMoneyBillWave } from 'react-icons/fa';

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

interface Enrollment {
  _id: string;
  student: {
    _id: string;
    name: string;
    email: string;
  };
  course: string;
  paymentStatus: boolean;
  lastPaymentDate?: string;
  paymentNotes?: string;
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

// Combina la información de estudiante, asistencia y pago
interface StudentRecord {
  _id: string;
  name: string;
  email: string;
  present: boolean | null;
  attendanceNotes: string;
  paymentStatus: boolean;
  lastPaymentDate?: string;
  paymentNotes?: string;
  enrollmentId?: string;
  attendanceId?: string;
}

// Add interface for month-specific payment data
interface MonthPaymentData {
  courseId: string;
  courseName: string;
  month: number;
  year: number;
  targetMonth: string;
  totalStudents: number;
  paidCount: number;
  unpaidCount: number;
  paidStudents: Array<{
    studentId: string;
    studentName: string;
    studentEmail: string;
    month: string;
  }>;
  unpaidStudents: Array<{
    studentId: string;
    studentName: string;
    studentEmail: string;
    month: string;
  }>;
}

export default function IntegratedAttendancePage() {
  
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [monthPaymentData, setMonthPaymentData] = useState<MonthPaymentData | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [studentRecords, setStudentRecords] = useState<StudentRecord[]>([]);
  const [date, setDate] = useState<string>(getCurrentGMT5Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  const fetchEnrollments = useCallback(async (courseId: string) => {
    if (!courseId) return;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/courses/${courseId}/enrollments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setEnrollments(response.data);
    } catch (error) {
      const errorMsg = handleApiError(error);
      setError(errorMsg || 'Error al cargar las inscripciones');
    }
  }, [handleApiError]);

  // Add new function to fetch month-specific payment data
  const fetchMonthPaymentData = useCallback(async (courseId: string, selectedDate: string) => {
    if (!courseId || !selectedDate) return;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Extract month and year from the selected date string (YYYY-MM-DD format)
      // Parse manually to avoid timezone issues with Date constructor
      const [yearStr, monthStr, dayStr] = selectedDate.split('-');
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);
      
      const response = await axios.get(`${apiUrl}/api/courses/${courseId}/unpaid-students?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMonthPaymentData(response.data);
    } catch (error: any) {
      const errorMsg = handleApiError(error);
      setError(errorMsg || 'Error al cargar los datos de pago del mes');
    }
  }, [handleApiError]);

  const fetchAttendances = useCallback(async (courseId: string, attendanceDate: string) => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Use utility function to get UTC range for GMT-5 date
      const { startUTC, endUTC } = getUTCRangeForGMT5Date(attendanceDate);
      
      const response = await axios.get(`${apiUrl}/api/attendance/course/${courseId}?date=${startUTC.toISOString()}`, {
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
      // Si no hay asistencias para esta fecha, inicializar array vacío
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Combinar datos de estudiantes, asistencia y pagos
  const combineStudentData = useCallback(() => {
    if (!selectedCourse) return;
    
    const course = courses.find(c => c._id === selectedCourse);
    if (!course || !course.students) return;
    
    const records: StudentRecord[] = course.students.map(student => {
      // Buscar la inscripción del estudiante
      const enrollment = enrollments.find(e => e.student._id === student._id);
      
      // Buscar el registro de asistencia del estudiante
      const attendance = attendances.find(a => a.studentId === student._id);
      
      // Check month-specific payment status
      let monthPaymentStatus = false;
      if (monthPaymentData) {
        monthPaymentStatus = monthPaymentData.paidStudents.some(paid => paid.studentId === student._id);

      }
      
      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        present: attendance ? attendance.present : null,
        attendanceNotes: attendance?.notes || '',
        paymentStatus: monthPaymentStatus, // Use month-specific payment status
        lastPaymentDate: enrollment?.lastPaymentDate,
        paymentNotes: enrollment?.paymentNotes || '',
        enrollmentId: enrollment?._id,
        attendanceId: attendance?._id
      };
    });
    
    // Ordenar los registros alfabéticamente por nombre
    const sortedRecords = [...records].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
    
    setStudentRecords(sortedRecords);
  }, [selectedCourse, courses, enrollments, attendances, monthPaymentData]);

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
      setLoading(true);
      Promise.all([
        fetchEnrollments(selectedCourse),
        fetchAttendances(selectedCourse, date),
        fetchMonthPaymentData(selectedCourse, date)
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [selectedCourse, date, fetchEnrollments, fetchAttendances, fetchMonthPaymentData]);

  useEffect(() => {
    combineStudentData();
  }, [combineStudentData]);

  const handlePresentChange = (studentId: string, present: boolean) => {
    setStudentRecords(prevRecords => 
      prevRecords.map(record => 
        record._id === studentId 
          ? { ...record, present } 
          : record
      )
    );
  };

  const handleAttendanceNotesChange = (studentId: string, notes: string) => {
    setStudentRecords(prevRecords => 
      prevRecords.map(record => 
        record._id === studentId 
          ? { ...record, attendanceNotes: notes } 
          : record
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCourse) {
      setError('Debes seleccionar un curso');
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Use utility function to convert GMT-5 date to UTC
      const utcDate = convertGMT5ToUTC(date);
      const dateString = utcDate.toISOString();
      
      console.log('Original GMT-5 date string:', date);
      console.log('UTC date to send:', dateString);
      
      if (!dateString) {
        setError('Formato de fecha inválido');
        setSaving(false);
        return;
      }
      
      // Convertir registros sin selección a 'ausente' (present: false)
      const processedRecords = studentRecords.map(record => ({
        ...record,
        present: record.present === null ? false : record.present
      }));
      
      // Preparar los datos de asistencia
      const bulkData = {
        courseId: selectedCourse,
        date: dateString,
        attendances: processedRecords.map(record => ({
          studentId: record._id,
          present: record.present,
          notes: record.attendanceNotes
        }))
      };
      

      
      await axios.post(`${apiUrl}/api/attendance/bulk`, bulkData, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSuccess('Asistencia registrada correctamente');
      
      // Actualizar asistencias
      fetchAttendances(selectedCourse, date);
    } catch (error: any) {
      const errorMsg = handleApiError(error);
      
      setError(errorMsg || 'Error al guardar la asistencia');
    } finally {
      setSaving(false);
    }
  };

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = e.target.value;
    setSelectedCourse(courseId);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  // Obtener el curso seleccionado para acceder a sus estudiantes
  const selectedCourseObj = courses.find(course => course._id === selectedCourse);

  // Calcular estadísticas
  const countPresent = studentRecords.filter(record => record.present === true).length;
  const countAbsent = studentRecords.filter(record => record.present === false).length;
  const countNoSelection = studentRecords.filter(record => record.present === null).length;
  const countPaid = studentRecords.filter(record => record.paymentStatus).length;
  const countUnpaid = studentRecords.length - countPaid;

  return (
    <Layout title="Control de Asistencia y Pagos | Dance Platform">
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.header}>
            <h1 className={styles.title}>Control de Asistencia y Pagos</h1>
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
              <label htmlFor="date">
                <FaCalendarAlt style={{ marginRight: '6px' }} />
                Fecha:
              </label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={handleDateChange}
                className={styles.dateInput}
                disabled={loading}
              />
            </div>
          </div>
          
          {loading ? (
            <div className={styles.loading}>Cargando datos...</div>
          ) : selectedCourse && studentRecords.length > 0 ? (
            <form onSubmit={handleSubmit} className={styles.attendanceForm}>
              <div className={styles.statsContainer}>
                <div className={styles.statCard}>
                  <div className={styles.statTitle}>
                    <FaUserCheck style={{ color: '#38a169', marginRight: '6px' }} />
                    Asistencia
                  </div>
                  <div className={styles.statNumbers}>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{countPresent}</span>
                      <span className={styles.statLabel}>Presentes</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{countAbsent}</span>
                      <span className={styles.statLabel}>Ausentes</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{countNoSelection}</span>
                      <span className={styles.statLabel}>Sin Selección</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{studentRecords.length}</span>
                      <span className={styles.statLabel}>Total</span>
                    </div>
                  </div>
                </div>
                
                <div className={styles.statCard}>
                  <div className={styles.statTitle}>
                    <FaMoneyBillWave style={{ color: '#38a169', marginRight: '6px' }} />
                    Pagos
                  </div>
                  <div className={styles.statNumbers}>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{countPaid}</span>
                      <span className={styles.statLabel}>Pagados</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{countUnpaid}</span>
                      <span className={styles.statLabel}>Pendientes</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{studentRecords.length}</span>
                      <span className={styles.statLabel}>Total</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={styles.attendanceTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.countColumn}>#</div>
                  <div className={styles.studentColumn}>Estudiante</div>
                  <div className={styles.presentColumn}>Asistencia</div>
                  <div className={styles.notesColumn}>Notas</div>
                  <div className={styles.paymentColumn}>Estado de Pago</div>
                </div>
                
                <div className={styles.tableBody}>
                  {studentRecords.map((student, index) => (
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
                              checked={student.present === true}
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
                              checked={student.present === false}
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
                          value={student.attendanceNotes || ''}
                          onChange={(e) => handleAttendanceNotesChange(student._id, e.target.value)}
                          placeholder="Notas de asistencia"
                          className={styles.notesInput}
                        />
                      </div>
                      
                      <div className={styles.paymentColumn}>
                        <span className={
                          student.paymentStatus 
                            ? styles.paymentStatusPaid 
                            : styles.paymentStatusUnpaid
                        }>
                          {student.paymentStatus ? (
                            <>
                              <FaCreditCard style={{ marginRight: '4px' }} />
                              Pagado
                            </>
                          ) : (
                            <>
                              <FaMoneyBillWave style={{ marginRight: '4px' }} />
                              Pendiente
                            </>
                          )}
                        </span>
                        {student.lastPaymentDate && (
                          <div className={styles.lastPaymentDate}>
                            <FaCalendarAlt style={{ marginRight: '4px', fontSize: '0.8rem' }} />
                            Último pago: {new Date(student.lastPaymentDate).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                          </div>
                        )}
                        {student.paymentNotes && (
                          <div className={styles.paymentNotes}>
                            {student.paymentNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
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
            </form>
          ) : selectedCourse ? (
            <div className={styles.noStudents}>
              No hay estudiantes inscritos en este curso.
            </div>
          ) : (
            <div className={styles.instructions}>
              <p>Selecciona un curso para gestionar la asistencia y ver el estado de pagos.</p>
            </div>
          )}
          
          {selectedCourse && (
            <div className={styles.actions}>
              <Link href={`/course/${selectedCourse}`} className={styles.link}>
                Volver al Curso
              </Link>
              <Link href={`/course/attendance/stats/${selectedCourse}`} className={styles.link}>
                Ver Estadísticas de Asistencia
              </Link>
              {currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'school_owner' ? (
                <Link href={`/admin/payment-management`} className={styles.link}>
                  Gestionar Pagos
                </Link>
              ) : (
                <Link href={`/teacher/payment-status`} className={styles.link}>
                  Ver Estado de Pagos
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
} 