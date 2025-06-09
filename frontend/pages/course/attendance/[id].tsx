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
import { getCurrentGMT5Date, formatUTCDateAsGMT5, convertGMT5ToUTC } from '../../../utils/timezone-utils';

interface Student {
  _id: string;
  name: string;
  email: string;
  status?: string;
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

interface UnpaidStudent {
  studentId: string;
  studentName: string;
  studentEmail: string;
  month: string;
}

interface UnpaidStudentsData {
  courseId: string;
  courseName: string;
  month: number;
  year: number;
  targetMonth: string;
  totalStudents: number;
  paidCount: number;
  unpaidCount: number;
  paidStudents: UnpaidStudent[];
  unpaidStudents: UnpaidStudent[];
}

export default function AttendancePage() {
  const router = useRouter();
  const { id } = router.query; // id del curso
  const [course, setCourse] = useState<Course | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [date, setDate] = useState(getCurrentGMT5Date());
  const [lastFetchedDate, setLastFetchedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState<DecodedToken | null>(null);
  const [showAddNonRegisteredModal, setShowAddNonRegisteredModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [unpaidStudents, setUnpaidStudents] = useState<UnpaidStudentsData | null>(null);
  const [loadingUnpaid, setLoadingUnpaid] = useState(false);

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

  const fetchUnpaidStudents = useCallback(async () => {
    if (!id || !date) return;
    
    try {
      setLoadingUnpaid(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Extract month and year from the selected date string (YYYY-MM-DD format)
      const [yearStr, monthStr] = date.split('-');
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10);
      
      const response = await axios.get(
        `${apiUrl}/api/courses/${id}/unpaid-students?month=${month}&year=${year}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setUnpaidStudents(response.data);
    } catch (error: any) {
      console.error('Error fetching unpaid students:', error);
    } finally {
      setLoadingUnpaid(false);
    }
  }, [id, date]);

  const fetchAttendances = useCallback(async () => {
    if (!id || !date || !course) {
      return;
    }
    try {
      setLoading(true);
      setError('');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      // Convert GMT-5 date to UTC for backend query
      const utcDate = convertGMT5ToUTC(date);
      
      const response = await axios.get(`${apiUrl}/api/attendance/course/${id}?date=${utcDate.toISOString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const finalAttendanceMap = new Map<string, Attendance>();
      
      // 1. Pre-cargar studentInfoMap si hay IDs de string en la respuesta de la API para optimizar
      let studentInfoMap: Record<string, any> = {};
      if (response.data && Array.isArray(response.data)) {
        const studentIdsToFetchDetails = new Set<string>();
        response.data.forEach((att: any) => {
          if (typeof att.student === 'string') {
            studentIdsToFetchDetails.add(att.student);
          }
        });
        if (studentIdsToFetchDetails.size > 0) {
          try {
            const studentsPromises = Array.from(studentIdsToFetchDetails).map(async (studentId) => {
              try {
                const studentResponse = await axios.get(`${apiUrl}/api/users/${studentId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                return studentResponse.data;
              } catch (error: any) {
                return { _id: studentId, name: 'Usuario no encontrado en API' };
              }
            });
            const studentResults = await Promise.all(studentsPromises);
            studentResults.forEach(student => {
              if (student && student._id) {
                studentInfoMap[student._id] = student;
              }
            });
          } catch (error) {
            console.error("Error fetching student details in batch for API records", error);
          }
        }
      }
      
      // 2. Procesar estudiantes del curso primero (esta es la lista "maestra")
      // Solo incluir estudiantes activos en la lista de asistencia
      if (course && course.students) {
        for (const student of course.students) {
          if (student && student._id && student.name !== 'Usuario no encontrado') {
            // Solo incluir estudiantes activos o sin estado definido (por compatibilidad)
            const isActive = !student.status || student.status === 'active';
            if (isActive) {
              finalAttendanceMap.set(student._id, {
                studentId: student._id,
                studentName: student.name,
                present: null, // Default, se sobrescribirá si hay registro en API
                notes: '',
                isRegistered: true,
                isTemporary: false, 
              });
            } else {

            }
          }
        }
      }

      // 3. Actualizar con datos de la API si existen
      if (response.data && Array.isArray(response.data)) {
        for (const apiRecord of response.data) {
          let studentIdFromApi: string | undefined;
          let studentNameFromApi: string | undefined;
          let isRegisteredFromApi = false;
          
          if (typeof apiRecord.student === 'object' && apiRecord.student !== null) {
            studentIdFromApi = apiRecord.student._id;
            studentNameFromApi = apiRecord.student.name;
            isRegisteredFromApi = true;
          } else if (typeof apiRecord.student === 'string') {
            studentIdFromApi = apiRecord.student;
            let studentDetail; // Declarar studentDetail aquí
            if (studentIdFromApi) { // Asegurarse que studentIdFromApi no es undefined
              studentDetail = studentInfoMap[studentIdFromApi]; // Usar el mapa pre-cargado
            }
              
            if (studentDetail && studentDetail.name !== 'Usuario no encontrado en API') {
                studentNameFromApi = studentDetail.name;
                isRegisteredFromApi = true;
            } else if (course?.students.find(s => s._id === studentIdFromApi)){
                // Fallback si no estaba en studentInfoMap pero sí en el curso (debería ser raro)
                const courseStudent = course.students.find(s => s._id === studentIdFromApi);
                studentNameFromApi = courseStudent?.name;
                isRegisteredFromApi = true;
            } else {
                // Si no se puede resolver el nombre, podríamos marcarlo para revisión o ignorarlo
                // Por ahora, si no podemos obtener un nombre, no lo incluimos o lo marcamos.
                // Si studentNameFromApi queda undefined, se filtrará más abajo.
            }
          }

          if (studentIdFromApi && studentNameFromApi && studentNameFromApi !== 'Usuario no encontrado en API') {
            const existingEntry = finalAttendanceMap.get(studentIdFromApi);
            if (existingEntry) { // Si ya estaba por el curso, actualizar con datos de API
              existingEntry._id = apiRecord._id; 
              existingEntry.present = apiRecord.present === true ? true : apiRecord.present === false ? false : null;
              existingEntry.notes = apiRecord.notes || '';
              // studentName e isRegistered ya están seteados desde la info del curso (más confiable)
            } else {
              // Estudiante en API pero no en el curso actual (ej. un "no registrado" que ya no está o error)
              // Decidimos no añadirlo si no está en la lista oficial de course.students para evitar "fantasmas"
              // Si se quisiera mostrar TODO lo de la API, aquí se añadiría a finalAttendanceMap.

            }
          }
        }
      }
      
      // 4. Convertir el mapa a array y ordenar
      const finalAttendancesArray = Array.from(finalAttendanceMap.values())
          .filter(att => att.studentName && att.studentName !== 'Usuario no encontrado en API' && att.studentName !== 'Estudiante desconocido'); // Filtro final
          
      finalAttendancesArray.sort((a, b) => (a.studentName || '').localeCompare((b.studentName || ''), undefined, { sensitivity: 'base' }));
        

      
      // Preserve user's current selections only when refreshing data for the SAME date
      setAttendances(prevAttendances => {
        // If there are no previous attendances, just set the new data
        if (prevAttendances.length === 0) {
          setLastFetchedDate(date);
          return finalAttendancesArray;
        }
        
        // If date has changed, reset selections and use fresh data
        if (lastFetchedDate !== date) {
          setLastFetchedDate(date);
          return finalAttendancesArray;
        }
        
        // Date is the same, so preserve user's current selections when refreshing
        const currentSelections = new Map<string, { present: boolean | null, notes: string }>();
        prevAttendances.forEach(attendance => {
          if (attendance.present !== null || attendance.notes) {
            currentSelections.set(attendance.studentId, {
              present: attendance.present,
              notes: attendance.notes || ''
            });
          }
        });
        
        // Apply current selections to the new data
        const mergedAttendances = finalAttendancesArray.map(newAttendance => {
          const currentSelection = currentSelections.get(newAttendance.studentId);
          if (currentSelection) {
            return {
              ...newAttendance,
              present: currentSelection.present,
              notes: currentSelection.notes
            };
          }
          return newAttendance;
        });
        
        return mergedAttendances;
      });

    } catch (error) {
      console.error('Error fetching attendances:', error);
      setError('No se pudieron cargar los registros de asistencia. Intente de nuevo.');
      setAttendances([]);
    } finally {
      setLoading(false);
    }
  }, [id, date, course]); // Eliminado token de las dependencias

  // Load data when component mounts and when id changes
  useEffect(() => {
    if (id) {
      fetchCourse();
    }
  }, [id, fetchCourse]);

  // Load payment data when course, date change
  useEffect(() => {
    if (id && date) {
      fetchUnpaidStudents();
    }
  }, [id, date, fetchUnpaidStudents]);

  // Load attendances when course and date change
  useEffect(() => {
    if (course && date) {
      fetchAttendances();
    }
  }, [course, date, fetchAttendances]);

  // Function to check if a student has paid for the current month
  const hasStudentPaid = (studentId: string): boolean => {
    if (!unpaidStudents) {
      return false; // Default to unpaid (X) if no payment data loaded
    }
    
    // Check if this student is explicitly in the PAID list
    const isInPaidList = unpaidStudents.paidStudents?.some(paid => paid.studentId === studentId) || false;
    
    return isInPaidList;
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
      

      
      // Agregar el asistente a la lista local con su ID real
      const newAttendance = {
        studentId: response.data._id, // Usar el ID real devuelto por la API
        studentName: studentName,
        present: null,
        notes: '',
        isRegistered: false,
        isTemporary: false // Ya no es temporal porque existe en la base de datos
      };
      setAttendances(prev => {
        // Elimina cualquier entrada temporal con el mismo nombre
        const filtered = prev.filter(a => a.studentName?.toLowerCase() !== studentName.toLowerCase());
        return [...filtered, newAttendance];
      });
      // Refrescar la lista de estudiantes y asistencias para asegurar que el usuario aparece correctamente
      await fetchCourse();
      await fetchAttendances();
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
          return {
            ...attendance,
            present: attendance.present === null ? false : attendance.present,
            studentId: attendance.studentId,
            _id: attendance._id
          };
        });
      

      
      // If we have no attendance records to save, skip
      if (attendancesToSave.length === 0) {
        setSuccess('No hay asistencias para guardar');
        setSaving(false);
        return;
      }
      
      const promises = attendancesToSave.map(async (attendance) => {
        try {
          let dateString: string;
          if (date.length === 10) { // yyyy-MM-dd
            // Use utility function to convert GMT-5 date to UTC
            const utcDate = convertGMT5ToUTC(date);
            dateString = utcDate.toISOString();
          } else {
            // Si ya viene con hora, usar tal cual
            dateString = new Date(date).toISOString();
          }
          
          if (attendance._id) { // Actualizar registro existente
            const updateData = {
            present: attendance.present,
            notes: attendance.notes || '',
              date: dateString, // El backend puede optar por usar esta fecha o no para el campo 'date' en sí
              courseId: id as string
            };

            return axios.patch(`${apiUrl}/api/attendance/${attendance._id}`, updateData, {
              headers: { Authorization: `Bearer ${token}` }
            }).catch(error => {
              console.error(`Error updating attendance ${attendance._id}:`, error.response?.status, error.response?.data);
              throw error;
            });
          } else { // Crear nuevo registro
            const createData: any = {
              courseId: id as string,
              studentId: attendance.studentId, // Este es el ObjectId del usuario (registrado o no registrado)
              date: dateString, // El backend usará la fecha de aquí para buscar duplicados, pero new Date() para el registro en sí.
              present: attendance.present,
              notes: attendance.notes || ''
              // No se envía isRegistered. El backend asume que studentId es un ObjectId de User.
            };
            

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
    // Mantener la fecha local seleccionada
    setDate(e.target.value);
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
      
      // Solo los roles permitidos pueden acceder a esta página
      const allowedRoles = ['teacher', 'admin', 'school_owner', 'super_admin', 'administrative'];
      if (!allowedRoles.includes(decoded.role.toLowerCase())) {
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
  
  // Efecto separado para cargar las asistencias cuando cambia la fecha o el curso (para tener los students)
  useEffect(() => {
    if (id && date && course) { // Asegurarse de que course está cargado antes de fetchAttendances
      fetchAttendances();
    }
  }, [id, date, course, fetchAttendances]); // fetchAttendances ahora depende de course

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
          // Use utility function to format UTC date as GMT-5
          const formattedDate = formatUTCDateAsGMT5(new Date(attendance.date));
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
                    onClick={fetchAttendances}
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
                        <th style={{ width: '60px', textAlign: 'center' }}>💰</th>
                        {/*<th>Fecha/Hora (GMT-5)</th>*/}
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
                              <td style={{ textAlign: 'center' }}>
                                {hasStudentPaid(attendance.studentId) ? (
                                  <FaCheck style={{ color: '#38a169', fontSize: '1rem' }} title="Pagado" />
                                ) : (
                                  <FaTimes style={{ color: '#e53e3e', fontSize: '1rem' }} title="Sin pago" />
                                )}
                              </td>
                              {/*<td>
                                {attendance._id && attendance.date && (
                                  (() => {
                                    const limaDate = toZonedTime(new Date(attendance.date), 'America/Lima');
                                    return (
                                      <span>
                                        {format(limaDate, 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                                      </span>
                                    );
                                  })()
                                )}
                              </td>*/}
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