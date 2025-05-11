import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../../styles/Admin.module.css';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaPlus, FaCheck, FaTimes, FaArrowLeft, FaCalendarAlt, FaSave, FaChalkboardTeacher } from 'react-icons/fa';

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
  present: boolean | null;
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
      
      const courseData = response.data;
      
      if (courseData.students && Array.isArray(courseData.students)) {
        if (courseData.students.length > 0 && typeof courseData.students[0] !== 'object') {
          try {
            const studentsResponse = await Promise.all(
              courseData.students.map(async (studentId: string) => {
                try {
                  const studentResponse = await axios.get(`${apiUrl}/api/users/${studentId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  return studentResponse.data;
                } catch (error) {
                  return { _id: studentId, name: 'Usuario no encontrado' };
                }
              })
            );
            
            courseData.students = studentsResponse;
          } catch (error) {
            // Error silencioso
          }
        }
      }
      
      setCourse(courseData);
    } catch (error) {
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
      
      console.log(`Fetching attendance for course ${id} on date ${date}`);
      
      const response = await axios.get(`${apiUrl}/api/attendance/course/${id}?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Raw attendance response data:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        const studentIdsToFetch = new Set<string>();
        
        response.data.forEach(attendance => {
          if (typeof attendance.student === 'string') {
            studentIdsToFetch.add(attendance.student);
          }
        });
        
        let studentInfoMap: Record<string, any> = {};
        
        if (studentIdsToFetch.size > 0) {
          try {
            const studentsPromises = Array.from(studentIdsToFetch).map(async (studentId) => {
              try {
                const studentResponse = await axios.get(`${apiUrl}/api/users/${studentId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                return studentResponse.data;
              } catch (error: any) {
                return { _id: studentId, name: 'Usuario no encontrado' };
              }
            });
            
            const studentResults = await Promise.all(studentsPromises);
            
            studentResults.forEach(student => {
              if (student && student._id) {
                studentInfoMap[student._id] = student;
              }
            });
            
            for (const studentId of Array.from(studentIdsToFetch)) {
              if (studentId.includes('test')) {
                await debugTestUser(studentId);
              }
            }
          } catch (error) {
            // Error silencioso
          }
        }
        
        const mappedAttendancesPromises = response.data.map(async (attendance) => {
          let studentName = '';
          let studentId = '';
          let isRegistered = false;
          
          if (typeof attendance.student === 'object' && attendance.student !== null) {
            isRegistered = true;
            studentId = attendance.student._id || '';
            studentName = attendance.student.name || '';
            
            if (studentName === 'Usuario no encontrado') {
              return null;
            }
          } else if (typeof attendance.student === 'string') {
            studentId = attendance.student;
            isRegistered = true;
            
            if (studentInfoMap[studentId]) {
              studentName = studentInfoMap[studentId].name;
              
              if (studentName === 'Usuario no encontrado') {
                return null;
              }
            } else if (attendance.studentName) {
              studentName = attendance.studentName;
              isRegistered = false;
              
              if (studentName === 'Usuario no encontrado') {
                return null;
              }
            } else {
              try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                const token = Cookies.get('token');
                
                const userResponse = await axios.get(`${apiUrl}/api/users/${studentId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                
                if (userResponse.data && userResponse.data.name) {
                  studentName = userResponse.data.name;
                  isRegistered = true;
                  
                  if (studentName === 'Usuario no encontrado') {
                    return null;
                  }
                }
              } catch (userError) {
                if (course && course.students) {
                  const courseStudent = course.students.find(s => {
                    if (typeof s === 'object' && s !== null) {
                      return s._id === studentId;
                    }
                    return String(s) === studentId;
                  });
                  
                  if (courseStudent) {
                    if (typeof courseStudent === 'object' && courseStudent.name) {
                      studentName = courseStudent.name;
                      
                      if (studentName === 'Usuario no encontrado') {
                        return null;
                      }
                    }
                  }
                }
              }
              
              if (!studentName) {
                return null;
              }
            }
          } else {
            return null;
          }
          
          return {
            _id: attendance._id,
            studentId: studentId,
            studentName: studentName,
            present: attendance.present === true ? true : attendance.present === false ? false : null,
            notes: attendance.notes || '',
            isRegistered: isRegistered
          };
        });
        
        const mappedAttendances = (await Promise.all(mappedAttendancesPromises))
          .filter(attendance => attendance !== null)
          // Sort alphabetically by student name
          .sort((a, b) => (a.studentName || '').localeCompare((b.studentName || ''), undefined, { sensitivity: 'base' }));
        
        console.log('Mapped attendance records:', mappedAttendances);
        
        setAttendances(mappedAttendances);
      } else {
        console.log('No attendance data found for this day or data is not in expected format');
        setAttendances([]);
      }
    } catch (error) {
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  };

  const initializeAttendances = () => {
    if (!course || !course.students) {
      return;
    }
    
    const newAttendances = [...attendances];
    
    const loadStudentDetails = async (studentId: string) => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const token = Cookies.get('token');
        
        const response = await axios.get(`${apiUrl}/api/users/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data && response.data.name) {
          return response.data.name;
        }
      } catch (error) {
        // Error silencioso
      }
      return null;
    };
    
    const processStudents = async () => {
      for (const student of course.students) {
        const exists = attendances.some(a => {
          if (typeof student === 'object' && student !== null) {
            return a.studentId === student._id;
          } else {
            return a.studentId === String(student);
          }
        });
        
      if (!exists) {
          let studentId = '';
          let studentName = '';
          
          if (typeof student === 'object' && student !== null) {
            studentId = student._id || '';
            studentName = student.name || '';
            
            if (studentName === 'Usuario no encontrado') {
              continue;
            }
          } else {
            studentId = String(student);
            
            const additionalName = await loadStudentDetails(studentId);
            if (additionalName) {
              studentName = additionalName;
              
              if (studentName === 'Usuario no encontrado') {
                continue;
              }
            } else {
              const existingAttendance = attendances.find(a => a.studentId === studentId);
              if (existingAttendance && existingAttendance.studentName) {
                studentName = existingAttendance.studentName;
                
                if (studentName === 'Usuario no encontrado') {
                  continue;
                }
              } else {
                studentName = 'Estudiante sin nombre';
              }
            }
          }
          
          if (!studentName) {
            studentName = 'Estudiante sin nombre';
          }
          
        newAttendances.push({
            studentId: studentId,
            studentName: studentName,
            present: null,
            notes: '',
            isRegistered: true
        });
      }
      }
    
    setAttendances(newAttendances);
    };
    
    processStudents();
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
    
    const exists = attendances.some(a => 
      a.studentName?.toLowerCase() === studentName.toLowerCase()
    );
    
    if (exists) {
      setError('Ya existe un estudiante con este nombre en la lista');
      return;
    }
    
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const newAttendance = {
      studentId: tempId,
      studentName: studentName,
      present: null,
      notes: '',
      isRegistered: false
    };
    
    setAttendances(prev => [...prev, newAttendance]);
    
    setNewStudentName('');
    setShowAddNonRegisteredModal(false);
    setSuccess('Estudiante no registrado añadido a la lista');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
      setSaving(true);
      setError('');
      setSuccess('');
      
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const attendancesToSave = attendances
        .filter(attendance => 
          attendance && 
          attendance.studentName && 
          attendance.studentName !== 'Usuario no encontrado')
        .map(attendance => ({
          ...attendance,
          present: attendance.present === null ? false : attendance.present // Convert null to false (absent)
        }));
      
      console.log('Attendances to save:', attendancesToSave.length);
      
      // If we have no attendance records to save, skip
      if (attendancesToSave.length === 0) {
        setSuccess('No hay asistencias para guardar');
        setSaving(false);
        return;
      }
      
      const promises = attendancesToSave.map(async (attendance) => {
        try {
          // Create proper date object with time component set to noon
          // CRITICAL: Create a string formatted date that won't be modified by the backend
          // The backend's date.setHours() calls are causing issues because they mutate the date object
          const dateString = date + 'T12:00:00.000Z';
          
          // Only include fields expected by the DTO to avoid validation errors
          const data: any = {
            courseId: id as string,
            studentId: attendance.studentId,
            date: dateString,
            present: attendance.present,
            notes: attendance.notes || '',
            isRegistered: attendance.isRegistered
          };
          
          // Include studentName for non-registered users
          if (attendance.studentName && !attendance.isRegistered) {
            data.studentName = attendance.studentName;
          }
          
          console.log('Sending attendance data:', data);

          if (attendance._id) {
            return axios.put(`${apiUrl}/api/attendance/${attendance._id}`, data, {
              headers: { Authorization: `Bearer ${token}` }
            });
          } else {
            // Add more detailed error handling for debugging
            try {
              const response = await axios.post(`${apiUrl}/api/attendance`, data, {
                headers: { Authorization: `Bearer ${token}` }
      });
              return response;
            } catch (err: any) {
              // Print specific error details
              console.error('POST error:', err);
              
              // Log the specific error response for better debugging
              if (err.response) {
                console.error('Error response status:', err.response.status);
                console.error('Error response data:', err.response.data);
                if (err.response.data && err.response.data.message) {
                  setError('Error API: ' + (typeof err.response.data.message === 'string' ? 
                    err.response.data.message : 
                    JSON.stringify(err.response.data.message)));
                }
              }
              
              console.error('Error request details:', {
                url: `${apiUrl}/api/attendance`,
                data: JSON.stringify(data),
                headers: { Authorization: 'Bearer [token]' }
              });
              throw err;
            }
          }
        } catch (error) {
          console.error('Error processing attendance data:', error);
          throw error;
        }
      });

      // Add each promise with its index to help identify which one fails
      const promiseResults = await Promise.allSettled(promises);
      
      // Check if any promise failed
      const failedPromises = promiseResults.filter(result => result.status === 'rejected');
      if (failedPromises.length > 0) {
        console.error(`${failedPromises.length} attendance records failed to save`);
        failedPromises.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Failed promise ${index}:`, result.reason);
          }
        });
        
        setError(`Error al guardar ${failedPromises.length} registros de asistencia`);
      } else {
        setSuccess('Asistencia guardada correctamente');
      fetchAttendances();
      }
    } catch (error: any) {
      console.error('Error al guardar asistencia:', error);
      
      // Detailed error logging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);
        console.error('Error response headers:', error.response.headers);
        
        // Display more specific error message if available
        if (error.response.data && error.response.data.message) {
          setError(`Error: ${error.response.data.message}`);
        } else {
          setError(`Error al guardar los registros de asistencia (${error.response.status})`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('Error request:', error.request);
        setError('No se recibió respuesta del servidor');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', error.message);
        setError('Ocurrió un error al guardar los registros de asistencia');
      }
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

  // Función para ayudar a depurar el problema con Test User
  const debugTestUser = async (studentId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      const response = await axios.get(`${apiUrl}/api/users/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      return response.data;
    } catch (error: any) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const token = Cookies.get('token');
        
        const nonRegisteredResponse = await axios.get(`${apiUrl}/api/attendance/records?student=${studentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (subError: any) {
        // Error silencioso
      }
      
      return null;
    }
  };

  if (loading && !course) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Control de Asistencia</h1>
        <h2 className={styles.courseTitle}>{course?.title || 'Cargando curso...'}</h2>
        
        <div className={styles.controlBar}>
          <Link href={`/course/${id}`} className={styles.backLink}>
            <FaArrowLeft /> Volver al Curso
          </Link>
          
          <div className={styles.dateSelector}>
            <label htmlFor="date">
              <FaCalendarAlt className={styles.iconSpacer} /> Fecha:
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={handleDateChange}
              className={styles.dateInput}
            />
          </div>
      </div>
      
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
        
      {loading ? (
        <div className={styles.loading}>Cargando registros de asistencia...</div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {attendances.length === 0 && (!course?.students || course.students.length === 0) ? (
            <div className={styles.emptyMessage}>
              No hay estudiantes en este curso. Agregue estudiantes desde la gestión del curso.
            </div>
          ) : attendances.length === 0 ? (
            <div className={styles.emptyMessage}>
              No hay registros de asistencia para este día. Inicialice la asistencia para generar los registros.
              <div className={styles.centerButtons}>
                <button 
                  type="button" 
                  className={styles.createButton}
                  onClick={initializeAttendances}
                >
                  Inicializar Asistencia
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Asistencia</th>
                      <th>Notas (opcional)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Sort attendances alphabetically by student name */}
                    {[...attendances]
                      .filter(attendance => 
                        attendance && 
                        attendance.studentName && 
                        attendance.studentName !== 'Usuario no encontrado')
                      .sort((a, b) => (a.studentName || '').localeCompare((b.studentName || ''), undefined, { sensitivity: 'base' }))
                      .map((attendance) => {
                        const name = attendance.studentName;
                        return (
                          <tr key={attendance.studentId}>
                            <td>
                              <div className={styles.studentName}>
                                <span className={styles.name}>{name}</span>
                                {!attendance.isRegistered && (
                                  <span className={`${styles.roleBadge} ${styles.unregistered}`}>no registrado</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className={styles.studentPresent}>
                                <label className={styles.radioLabel}>
                                  <input
                                    type="radio"
                                    name={`present-${attendance.studentId}`}
                                    checked={attendance.present === true}
                                    onChange={() => handlePresentChange(attendance.studentId, true)}
                                  />
                                  <FaCheck style={{ color: '#38a169' }} /> Presente
                                </label>
                                <label className={styles.radioLabel}>
                                  <input
                                    type="radio"
                                    name={`present-${attendance.studentId}`}
                                    checked={attendance.present === false}
                                    onChange={() => handlePresentChange(attendance.studentId, false)}
                                  />
                                  <FaTimes style={{ color: '#e53e3e' }} /> Ausente
                                </label>
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                value={attendance.notes || ''}
                                onChange={(e) => handleNotesChange(attendance.studentId, e.target.value)}
                                className={styles.input}
                                placeholder="Notas (opcional)"
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            
              <div className={styles.buttonContainer}>
                <button 
                  type="button" 
                  className={styles.altButton}
                  onClick={() => setShowAddNonRegisteredModal(true)}
                >
                  <FaPlus /> Agregar Asistente
                </button>
                
                <button 
                  type="submit" 
                  className={styles.createButton}
                  disabled={saving}
                >
                  <FaSave /> {saving ? 'Guardando...' : 'Guardar Asistencia'}
                </button>
              </div>
            </>
          )}
        </form>
      )}
      </main>
      
      {showAddNonRegisteredModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Agregar Asistente No Registrado</h2>
            <p className={styles.modalDescription}>
              Esta persona será registrada solo para asistencias, sin acceso a la plataforma.
            </p>
            
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="newStudentName">Nombre completo</label>
                <input
                  type="text"
                  id="newStudentName"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className={styles.input}
                  placeholder="Nombre del asistente"
                  autoFocus
                />
              </div>
              
              <div className={styles.formActions}>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowAddNonRegisteredModal(false);
                    setNewStudentName('');
                    setError('');
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={handleAddNonRegisteredStudent}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 