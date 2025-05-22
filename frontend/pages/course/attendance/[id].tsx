import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../../styles/Admin.module.css';
import Link from 'next/link';
import { format, parse, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaPlus, FaCheck, FaTimes, FaArrowLeft, FaCalendarAlt, FaSave, FaChalkboardTeacher, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';

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
  date?: string; // Para la exportación a Excel
  isTemporary?: boolean; // Indica si es un asistente temporal (no guardado aún)
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

// Nueva interfaz para agrupar asistencias mensuales
interface MonthlyAttendance {
  studentId: string;
  studentName: string;
  studentEmail: string;
  isRegistered: boolean;
  dates: {
    [date: string]: boolean | null;
  };
}

export default function AttendancePage() {
  const router = useRouter();
  const { id } = router.query; // id del curso
  const [course, setCourse] = useState<Course | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState<DecodedToken | null>(null);
  const [showAddNonRegisteredModal, setShowAddNonRegisteredModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  const fetchCourse = useCallback(async () => {
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
  }, [id]);

  const fetchAttendances = useCallback(async () => {
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
  }, [id, date]);

  const initializeAttendances = useCallback(() => {
    if (!course || !course.students) {
      return;
    }
    
    // En lugar de modificar el estado existente, crear una nueva lista
    // sin depender del estado actual de attendances
    const newAttendances: Attendance[] = [];
    
    // Procesar los estudiantes y crear registros de asistencia
    course.students.forEach(student => {
      // Verificar si ya existe este estudiante en la lista actual
      // Pero no hacer que este método dependa del estado attendances
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
            return; // Skip this student
          }
          
          newAttendances.push({
            studentId,
            studentName,
            present: null,
            notes: '',
            isRegistered: true
          });
        }
      }
    });
    
    // Solo si hay nuevos registros, añadirlos a los existentes
    if (newAttendances.length > 0) {
      setAttendances(prev => [...prev, ...newAttendances]);
    }
  }, [course, attendances]);

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

  const handleAddNonRegisteredStudent = async () => {
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
    
    setLoading(true);
    
    try {
      // Llamar a la API para crear el asistente permanentemente
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Usar la misma API que usa el admin para crear asistentes
      const response = await axios.post(
        `${apiUrl}/api/users/bypass-assistant`,
        {
          name: studentName,
          courseId: id // ID del curso actual
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Asistente creado con éxito:', response.data);
      
      // Agregar el asistente a la lista local con su ID real
      const newAttendance = {
        studentId: response.data._id, // Usar el ID real devuelto por la API
        studentName: studentName,
        present: null,
        notes: '',
        isRegistered: false,
        isTemporary: false // Ya no es temporal porque existe en la base de datos
      };
      
      setAttendances(prev => [...prev, newAttendance]);
      setNewStudentName('');
      setShowAddNonRegisteredModal(false);
      setSuccess('Asistente no registrado añadido correctamente');
      
    } catch (error) {
      console.error('Error al crear asistente:', error);
      setError('Error al crear el asistente. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
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
        .map(attendance => {
          // Si es un asistente no registrado, asegurar que se use el nombre
          if (!attendance.isRegistered) {
            console.log('Preparando asistente no registrado:', attendance.studentName);
          }
          
          return {
            ...attendance,
            present: attendance.present === null ? false : attendance.present,
            // Si es un asistente no registrado, enviar el nombre como studentId
            studentId: attendance.isRegistered ? attendance.studentId : attendance.studentName,
            _id: attendance._id // Ensure _id is included for existing records
          };
        });
      
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
            console.log('Updating existing attendance record with ID:', attendance._id);
            // Use PATCH instead of PUT as controller expects PATCH
            // Only send fields expected by UpdateAttendanceDto for updates
            const updateData = {
              present: attendance.present,
              notes: attendance.notes || '',
              // Only include date if explicitly changing it
              date: dateString
            };
            console.log('Sending update data:', updateData);
            return axios.patch(`${apiUrl}/api/attendance/${attendance._id}`, updateData, {
              headers: { Authorization: `Bearer ${token}` }
            }).catch(error => {
              console.error(`Error updating attendance ${attendance._id}:`, error.response?.status, error.response?.data);
              throw error;
            });
          } else {
            console.log('Creating new attendance record');
            // For creating new records, include all necessary fields
            const createData: any = {
              courseId: id as string,
              date: dateString,
              present: attendance.present === null ? false : attendance.present,
              notes: attendance.notes || ''
            };
            
            // Manejar diferentes casos para usuarios registrados y no registrados
            if (attendance.isRegistered) {
              // Usuario registrado - usar studentId
              createData.studentId = attendance.studentId;
              createData.isRegistered = true;
            } else {
              // Usuario no registrado - ya debe tener un ID real porque fue creado al agregarlo
              createData.studentId = attendance.studentId; // ID real del usuario
              createData.isRegistered = false;
              
              console.log('Guardando asistencia para asistente no registrado:', {
                id: attendance.studentId,
                nombre: attendance.studentName
              });
            }
            
            console.log('Sending create data:', createData);
            return axios.post(`${apiUrl}/api/attendance`, createData, {
              headers: { Authorization: `Bearer ${token}` }
            }).catch(error => {
              console.error('Error creating attendance:', error.response?.status, error.response?.data);
              throw error;
            });
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
        // Actualizar la lista de asistencias para reflejar los IDs permanentes
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
  }, [course, initializeAttendances]);

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

    // Solo cargar el curso una vez cuando el ID está disponible
    if (id) {
      fetchCourse();
    }
  }, [id, router, fetchCourse]);
  
  // Efecto separado para cargar las asistencias cuando cambia la fecha
  useEffect(() => {
    if (id && date) {
      fetchAttendances();
    }
  }, [id, date, fetchAttendances]);

  // Nuevas funciones para exportación de Excel
  const exportAttendanceToExcel = async () => {
    try {
      setExportLoading(true);
      
      // Obtener el año y mes actual del estado date
      const selectedDate = parse(date, 'yyyy-MM-dd', new Date());
      const month = selectedDate.getMonth() + 1;
      const year = selectedDate.getFullYear();
      const monthName = format(selectedDate, 'MMMM yyyy', { locale: es });
      
      // Obtener datos del curso
      if (!course) {
        setError('No hay información del curso disponible');
        setExportLoading(false);
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Usar el nuevo endpoint que retorna todas las asistencias del mes
      const response = await axios.get(
        `${apiUrl}/api/attendance/course/${id}/month?year=${year}&month=${month}`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Procesar los datos de asistencia
      const attendanceRecords = response.data;
      
      // Crear un mapa para agrupar las asistencias por estudiante y fecha
      const monthlyAttendances: MonthlyAttendance[] = [];
      const studentsMap = new Map<string, { name: string; email: string; isRegistered: boolean }>();
      
      // Preparar el mapa de estudiantes
      if (course.students && Array.isArray(course.students)) {
        course.students.forEach(student => {
          if (typeof student === 'object') {
            studentsMap.set(student._id, { 
              name: student.name, 
              email: student.email || '', 
              isRegistered: true 
            });
          }
        });
      }
      
      // Procesar cada registro de asistencia
      attendanceRecords.forEach((attendance: any) => {
        // Determinar la información del estudiante
        let studentId = '';
        let studentName = '';
        let studentEmail = '';
        let isRegistered = true;
        
        if (typeof attendance.student === 'object' && attendance.student) {
          // Estudiante registrado con datos poblados
          studentId = attendance.student._id;
          studentName = attendance.student.name;
          studentEmail = attendance.student.email || '';
        } else if (typeof attendance.student === 'string') {
          // Estudiante registrado sin datos poblados
          studentId = attendance.student;
          const studentInfo = studentsMap.get(studentId);
          
          if (studentInfo) {
            studentName = studentInfo.name;
            studentEmail = studentInfo.email;
          } else {
            studentName = 'Estudiante desconocido';
          }
        } else if (attendance.studentName) {
          // Estudiante no registrado
          studentId = attendance._id; // Usamos el ID de la asistencia como identificador
          studentName = attendance.studentName;
          isRegistered = false;
        }
        
        // Si no tenemos un ID de estudiante válido, omitir este registro
        if (!studentId) return;
        
        // Buscar o crear entrada para el estudiante
        let studentMonthlyAtt = monthlyAttendances.find(m => 
          m.studentId === studentId || 
          (!isRegistered && m.studentName === studentName)
        );
        
        if (!studentMonthlyAtt) {
          studentMonthlyAtt = {
            studentId,
            studentName,
            studentEmail,
            isRegistered,
            dates: {}
          };
          
          monthlyAttendances.push(studentMonthlyAtt);
        }
        
        // Añadir asistencia para la fecha
        if (attendance.date) {
          // Formatear la fecha al formato yyyy-MM-dd
          const attendanceDate = new Date(attendance.date);
          const formattedDate = format(attendanceDate, 'yyyy-MM-dd');
          studentMonthlyAtt.dates[formattedDate] = attendance.present;
        }
      });
      
      // Obtener todos los días del mes para las columnas
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      // Crear datos para Excel
      const excelRows = [];
      
      // Encabezados
      const headers = ['Nombre', 'Email', 'Estado'];
      
      // Añadir fechas como encabezados
      daysInMonth.forEach(day => {
        headers.push(format(day, 'dd/MM/yyyy'));
      });
      
      excelRows.push(headers);
      
      // Ordenar estudiantes alfabéticamente
      monthlyAttendances.sort((a, b) => a.studentName.localeCompare(b.studentName));
      
      // Datos de asistencia
      monthlyAttendances.forEach(att => {
        const row = [
          att.studentName,
          att.studentEmail,
          att.isRegistered ? 'Registrado' : 'No registrado'
        ];
        
        // Añadir asistencia para cada día del mes
        daysInMonth.forEach(day => {
          const formattedDate = format(day, 'yyyy-MM-dd');
          const present = att.dates[formattedDate];
          
          // Convertir el estado de asistencia a texto
          if (present === true) row.push('Presente');
          else if (present === false) row.push('Ausente');
          else row.push('No registrado');
        });
        
        excelRows.push(row);
      });
      
      // Crear hoja de Excel
      const ws = XLSX.utils.aoa_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencias');
      
      // Aplicar estilos a las celdas (anchos de columna)
      const colWidths = [
        { wch: 25 }, // Nombre
        { wch: 25 }, // Email
        { wch: 15 }  // Estado
      ];
      
      // Añadir anchos para las columnas de fechas
      daysInMonth.forEach(() => {
        colWidths.push({ wch: 12 });
      });
      
      ws['!cols'] = colWidths;
      
      // Generar el archivo
      const fileName = `Asistencias_${course.title.replace(/\s+/g, '_')}_${monthName}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      setSuccess(`Asistencias exportadas correctamente a ${fileName}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setError('Error al exportar las asistencias a Excel');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading && !course) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.headerRow}>
          <h1>
            <FaChalkboardTeacher className={styles.titleIcon} />
            {loading ? 'Cargando...' : `Asistencia de ${course?.title || 'curso'}`}
          </h1>
          <Link href={`/course/${id}`} className={styles.backButton}>
            <FaArrowLeft /> Volver al curso
          </Link>
        </div>
        
        <div className={styles.controlsRow}>
          <div className={styles.datePickerContainer}>
            <FaCalendarAlt className={styles.calendarIcon} />
            <input
              type="date"
              value={date}
              onChange={handleDateChange}
              className={styles.datePicker}
            />
          </div>
          
          <button
            onClick={exportAttendanceToExcel}
            className={`${styles.exportButton} ${exportLoading ? styles.loading : ''}`}
            disabled={loading || exportLoading}
          >
            <FaFileExcel /> 
            {exportLoading ? 'Exportando...' : 'Exportar mes a Excel'}
          </button>
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
                        <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                        <th style={{ width: '25%' }}>Estudiante</th>
                        <th style={{ width: '35%' }}>Asistencia</th>
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
                        .map((attendance, index) => {
                          const name = attendance.studentName;
                          return (
                            <tr key={attendance.studentId}>
                              <td style={{ textAlign: 'center', fontWeight: '600', fontSize: '1.1rem' }}>{index + 1}</td>
                              <td>
                                <div className={styles.studentName}>
                                  <span className={styles.name}>{name}</span>
                                  {!attendance.isRegistered && (
                                    <span className={`${styles.roleBadge} ${styles.unregistered}`}>no registrado</span>
                                  )}
                                  {attendance.isTemporary && (
                                    <span className={`${styles.roleBadge} ${styles.temporary}`} style={{ backgroundColor: '#f59e0b' }}>temporal</span>
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
                                    <FaCheck style={{ color: '#38a169', fontSize: '1.1rem' }} /> Presente
                                  </label>
                                  <label className={styles.radioLabel}>
                                    <input
                                      type="radio"
                                      name={`present-${attendance.studentId}`}
                                      checked={attendance.present === false}
                                      onChange={() => handlePresentChange(attendance.studentId, false)}
                                    />
                                    <FaTimes style={{ color: '#e53e3e', fontSize: '1.1rem' }} /> Ausente
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
                  disabled={loading}
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
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={handleAddNonRegisteredStudent}
                  disabled={loading}
                >
                  {loading ? 'Creando...' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 