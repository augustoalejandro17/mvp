import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../../styles/Attendance.module.css';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaPlus, FaCheck, FaTimes } from 'react-icons/fa';

interface Student {
  _id: string;
  name: string;
  email: string;
}

interface NonRegisteredStudent {
  name: string;
  isRegistered: false;
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
  isRegistered?: boolean; // True para usuario registrado, false para no registrado
  studentName?: string; // Nombre del estudiante (para no registrados)
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
  const [showAddNonRegisteredModal, setShowAddNonRegisteredModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');

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
        setAttendances(response.data.map(attendance => {
          // Si es un estudiante registrado (objeto) o no registrado (string)
          const isRegistered = typeof attendance.student === 'object';
          
          return {
            _id: attendance._id,
            studentId: isRegistered ? attendance.student._id : attendance.student,
            studentName: isRegistered ? attendance.student.name : attendance.student,
            present: attendance.present,
            notes: attendance.notes,
            isRegistered: isRegistered
          };
        }));
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
          studentName: student.name,
          present: true,
          notes: '',
          isRegistered: true
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

  const handleAddNonRegisteredStudent = () => {
    if (!newStudentName || newStudentName.trim() === '') {
      setError('Debe ingresar un nombre válido');
      return;
    }
    
    const studentName = newStudentName.trim();
    
    // Verificar si ya existe un estudiante con este nombre
    const exists = attendances.some(a => 
      a.studentName?.toLowerCase() === studentName.toLowerCase()
    );
    
    if (exists) {
      setError('Ya existe un estudiante con este nombre en la lista');
      return;
    }
    
    // Añadir nuevo estudiante no registrado
    setAttendances(prev => [
      ...prev,
      {
        studentId: studentName, // El ID es el nombre para no registrados
        studentName: studentName,
        present: true,
        notes: '',
        isRegistered: false
      }
    ]);
    
    // Limpiar y cerrar modal
    setNewStudentName('');
    setShowAddNonRegisteredModal(false);
    setSuccess('Estudiante no registrado añadido a la lista');
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
          notes: a.notes || '',
          isRegistered: a.isRegistered
        }))
      };
      
      await axios.post(`${apiUrl}/api/attendance/bulk`, bulkData, {
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSuccess('Asistencia registrada correctamente');
      
      // Recargar asistencias para tener los _id actualizados
      fetchAttendances();
    } catch (error) {
      console.error('Error al registrar asistencia:', error);
      setError('Ocurrió un error al guardar la asistencia');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  // Inicializar la lista cuando se carga el curso
  useEffect(() => {
    if (course) {
      initializeAttendances();
    }
  }, [course]);

  if (loading && !course) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Control de Asistencia</h1>
        {course && <h2>{course.title}</h2>}
        
        <div className={styles.controls}>
          <div className={styles.dateSelector}>
            <label htmlFor="date">Fecha:</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={handleDateChange}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          
          <button 
            className={styles.addButton}
            onClick={() => setShowAddNonRegisteredModal(true)}
          >
            <FaPlus /> Añadir Asistente No Registrado
          </button>
          
          <Link href={`/course/${id}`} className={styles.backButton}>
            Volver al Curso
          </Link>
        </div>
      </div>
      
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      
      <form onSubmit={handleSubmit} className={styles.attendanceForm}>
        <div className={styles.tableContainer}>
          <table className={styles.attendanceTable}>
            <thead>
              <tr>
                <th>Estudiante</th>
                <th>Asistencia</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {attendances.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.noData}>
                    No hay estudiantes para mostrar
                  </td>
                </tr>
              ) : (
                attendances.map(attendance => (
                  <tr key={attendance.studentId} className={attendance.isRegistered ? '' : styles.nonRegistered}>
                    <td>
                      {attendance.studentName || attendance.studentId}
                      {!attendance.isRegistered && <span className={styles.tagNonRegistered}>No Registrado</span>}
                    </td>
                    <td className={styles.attendanceStatus}>
                      <div className={styles.radioGroup}>
                        <label className={attendance.present ? styles.activeRadio : ''}>
                          <input
                            type="radio"
                            name={`present-${attendance.studentId}`}
                            checked={attendance.present}
                            onChange={() => handlePresentChange(attendance.studentId, true)}
                          />
                          <FaCheck className={styles.radioIcon} />
                          Presente
                        </label>
                        <label className={!attendance.present ? styles.activeRadio : ''}>
                          <input
                            type="radio"
                            name={`present-${attendance.studentId}`}
                            checked={!attendance.present}
                            onChange={() => handlePresentChange(attendance.studentId, false)}
                          />
                          <FaTimes className={styles.radioIcon} />
                          Ausente
                        </label>
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={attendance.notes || ''}
                        onChange={(e) => handleNotesChange(attendance.studentId, e.target.value)}
                        placeholder="Notas (opcional)"
                        className={styles.notesInput}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className={styles.submitContainer}>
          <button 
            type="submit" 
            className={styles.submitButton} 
            disabled={saving || attendances.length === 0}
          >
            {saving ? 'Guardando...' : 'Guardar Asistencia'}
          </button>
        </div>
      </form>
      
      {/* Modal para añadir estudiante no registrado */}
      {showAddNonRegisteredModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Añadir Asistente No Registrado</h2>
            <p className={styles.modalDescription}>
              Ingrese el nombre del asistente que no está registrado en el sistema
            </p>
            
            <div className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label htmlFor="studentName">Nombre completo:</label>
                <input
                  type="text"
                  id="studentName"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className={styles.input}
                  placeholder="Ej: Juan Pérez"
                  autoFocus
                />
              </div>
              
              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.confirmButton}
                  onClick={handleAddNonRegisteredStudent}
                >
                  Añadir
                </button>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={() => {
                    setNewStudentName('');
                    setShowAddNonRegisteredModal(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 