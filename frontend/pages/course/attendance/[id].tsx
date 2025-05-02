import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../../styles/Attendance.module.css';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Student {
  _id: string;
  name: string;
  email: string;
}

interface Course {
  _id: string;
  title: string;
  students: Student[];
}

interface Attendance {
  _id?: string;
  studentId: string;
  present: boolean;
  notes?: string;
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const { id } = router.query; // id del curso
  const [course, setCourse] = useState<Course | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
      fetchCourse();
      fetchAttendances();
    }
  }, [id, date, router]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/courses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCourse(response.data);
    } catch (error) {
      console.error('Error al obtener el curso:', error);
      setError('No se pudo cargar la información del curso');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendances = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/attendance/course/${id}?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Mapear las asistencias existentes
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
      // Si no hay asistencias para esta fecha, inicializar array vacío
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  };

  const initializeAttendances = () => {
    if (!course || !course.students) return;
    
    // Crear un registro de asistencia para cada estudiante que no tenga uno
    const newAttendances = [...attendances];
    
    course.students.forEach(student => {
      const exists = attendances.some(a => a.studentId === student._id);
      if (!exists) {
        newAttendances.push({
          studentId: student._id,
          present: true,
          notes: ''
        });
      }
    });
    
    setAttendances(newAttendances);
  };

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
    
    if (!course || !date) {
      setError('Faltan datos requeridos');
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Preparar el objeto de asistencia masiva
      const bulkData = {
        courseId: id,
        date: new Date(date),
        attendances: attendances.map(a => ({
          studentId: a.studentId,
          present: a.present,
          notes: a.notes
        }))
      };
      
      await axios.post(`${apiUrl}/api/attendance/bulk`, bulkData, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSuccess('Asistencia registrada correctamente');
      
      // Actualizar la lista de asistencias
      fetchAttendances();
    } catch (error) {
      console.error('Error al guardar asistencia:', error);
      setError('Error al guardar los datos de asistencia');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  // Inicializar asistencias si se carga el curso y no hay asistencias
  useEffect(() => {
    if (course && course.students && course.students.length > 0) {
      initializeAttendances();
    }
  }, [course]);

  if (loading) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  if (!course) {
    return <div className={styles.error}>No se encontró el curso</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Control de Asistencia</h1>
        <h2 className={styles.courseTitle}>{course.title}</h2>
        
        <div className={styles.controlBar}>
          <div className={styles.dateSelector}>
            <label htmlFor="date">Fecha:</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={handleDateChange}
              className={styles.dateInput}
            />
          </div>
          
          <Link href={`/course/${id}`} className={styles.backLink}>
            Volver al curso
          </Link>
        </div>
        
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          {course.students && course.students.length > 0 ? (
            <div className={styles.studentList}>
              <div className={styles.header}>
                <div className={styles.studentName}>Estudiante</div>
                <div className={styles.studentPresent}>Asistencia</div>
                <div className={styles.studentNotes}>Notas</div>
              </div>
              
              {course.students.map(student => {
                const attendance = attendances.find(a => a.studentId === student._id);
                const isPresent = attendance ? attendance.present : true;
                const notes = attendance ? attendance.notes : '';
                
                return (
                  <div key={student._id} className={styles.studentRow}>
                    <div className={styles.studentName}>
                      <span className={styles.name}>{student.name}</span>
                      <span className={styles.email}>{student.email}</span>
                    </div>
                    
                    <div className={styles.studentPresent}>
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name={`present-${student._id}`}
                          checked={isPresent}
                          onChange={() => handlePresentChange(student._id, true)}
                        />
                        <span>Presente</span>
                      </label>
                      
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name={`present-${student._id}`}
                          checked={!isPresent}
                          onChange={() => handlePresentChange(student._id, false)}
                        />
                        <span>Ausente</span>
                      </label>
                    </div>
                    
                    <div className={styles.studentNotes}>
                      <input
                        type="text"
                        placeholder="Notas (opcional)"
                        value={notes || ''}
                        onChange={(e) => handleNotesChange(student._id, e.target.value)}
                        className={styles.notesInput}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.noStudents}>
              No hay estudiantes matriculados en este curso.
            </div>
          )}
          
          {course.students && course.students.length > 0 && (
            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.saveButton}
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar Asistencia'}
              </button>
            </div>
          )}
        </form>
        
        <div className={styles.statsLink}>
          <Link href={`/course/attendance/stats/${id}`} className={styles.button}>
            Ver Estadísticas de Asistencia
          </Link>
        </div>
      </main>
    </div>
  );
} 