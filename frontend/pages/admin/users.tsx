import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/Admin.module.css';
import dashboardStyles from '../../styles/AdminDashboard.module.css';
import Link from 'next/link';
import { FaEdit, FaTrash, FaUserPlus, FaLink, FaUserCheck, FaSearch, FaClock, FaCheckCircle, FaEnvelope, FaUniversity, FaList, FaGraduationCap, FaCalendarAlt, FaMoneyBillWave, FaSpinner } from 'react-icons/fa';
import { useApiErrorHandler } from '../../utils/api-error-handler';
import PaymentRegistrationModal from '../../components/PaymentRegistrationModal';
import UserSearch from '../../components/UserSearch';
import AssignSchoolRoleModal from '../../components/AssignSchoolRoleModal';

// Tipos de usuario
enum UserType {
  REGISTERED = 'registered', // Usuario con acceso a la plataforma
  UNREGISTERED = 'unregistered' // Usuario solo para asistencias (sin acceso)
}

// Interfaces
interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  schoolRoles?: SchoolRole[];
  enrolledCourses?: string[];
  schools?: string[]; // Array de IDs de escuelas asociadas
  isRegistered?: boolean; // Para diferenciar usuarios registrados vs no registrados
  createdAt?: Date;
}

interface SchoolRole {
  schoolId: string;
  role: string;
}

interface Attendance {
  _id: string;
  student: string | {
    _id: string;
    name: string;
    email: string;
  };
  class: string;
  course: string;
  date: string;
  present: boolean;
  studentModel?: string; // Tipo de estudiante: 'User' o 'String'
}

interface School {
  _id: string;
  name: string;
}

interface Course {
  _id: string;
  title: string;
  school: string | School;
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

// Añadir un componente LoadingSpinner
const LoadingSpinner = ({ message }: { message: string }) => {
  return (
    <div className={styles.loadingOverlay}>
      <div className={styles.loadingContainer}>
        <FaSpinner className={styles.loadingSpinner} />
        <p>{message}</p>
        <p className={styles.loadingSubtext}>Esto puede tomar unos segundos</p>
      </div>
    </div>
  );
};

export default function UserManagement() {
  // Estados
  const [users, setUsers] = useState<User[]>([]);
  const [unregisteredUsers, setUnregisteredUsers] = useState<any[]>([]); // Usuarios sin registro
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Cargando usuarios...');
  const [dataReady, setDataReady] = useState(false); // Nuevo estado para controlar cuando los datos están realmente listos
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showUserCoursesModal, setShowUserCoursesModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userCourses, setUserCourses] = useState<any[]>([]);
  const [createUserType, setCreateUserType] = useState<UserType>(UserType.REGISTERED);
  const [schools, setSchools] = useState<School[]>([]);
  const [userSchools, setUserSchools] = useState<School[]>([]); // Escuelas asociadas al usuario actual
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserToLink, setSelectedUserToLink] = useState<any>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null); // Nuevo estado para controlar qué email está expandido
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student',
    password: '',
    school: '',
    course: '',
  });

  const [showAssignRoleModal, setShowAssignRoleModal] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);

  const router = useRouter();
  const { handleApiError } = useApiErrorHandler();

  // Obtener cursos de un usuario específico
  const getUserCourses = useCallback(async (userId: string) => {
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Primero, obtener la información directa del usuario para garantizar acceso a enrolledCourses
      const userResponse = await axios.get(`${apiUrl}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Verificar si hay enrolledCourses directamente en el usuario
      const hasDirectEnrolledCourses = 
        userResponse.data && 
        userResponse.data.enrolledCourses && 
        Array.isArray(userResponse.data.enrolledCourses) && 
        userResponse.data.enrolledCourses.length > 0;
      
      if (hasDirectEnrolledCourses) {
        // Si es un asistente (unregistered), obtener detalles de cursos directamente
        if (userResponse.data.role === 'unregistered') {
          // Obtener detalles de cada curso
          const coursesDetails = await Promise.all(
            userResponse.data.enrolledCourses.map(async (courseId: string) => {
              try {
                const courseResponse = await axios.get(`${apiUrl}/api/courses/${courseId}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                
                return courseResponse.data;
              } catch (error) {
                return { _id: courseId, title: 'Curso no disponible' };
              }
            })
          );
          
          return coursesDetails.filter(c => c); // Filtrar valores nulos
        }
      }
      
      // Para usuarios registrados o sin cursos directos, intentar con el endpoint
      const enrolledResponse = await axios.get(`${apiUrl}/api/courses/enrolled`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { userId }
      });
      
      // Si el endpoint devolvió datos, usarlos
      if (enrolledResponse.data && Array.isArray(enrolledResponse.data) && enrolledResponse.data.length > 0) {
        return enrolledResponse.data;
      }
      
      // Si llegamos aquí y hay enrolledCourses, usarlos como respaldo
      if (hasDirectEnrolledCourses) {
        // Obtener detalles de cada curso
        const coursesDetails = await Promise.all(
          userResponse.data.enrolledCourses.map(async (courseId: string) => {
            try {
              const courseResponse = await axios.get(`${apiUrl}/api/courses/${courseId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              return courseResponse.data;
            } catch (error) {
              return { _id: courseId, title: 'Curso no disponible' };
            }
          })
        );
        
        return coursesDetails.filter(c => c); // Filtrar valores nulos
      }
      
      // No se encontraron cursos
      return [];
    } catch (error) {
      return [];
    }
  }, []);

  // Obtener datos iniciales - definido con useCallback para poder usarlo como dependencia
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setDataReady(false); // Indicar que los datos no están listos
      setLoadingMessage('Obteniendo usuarios...');
      
      const token = Cookies.get('token');
      
      if (!token) {
        setError('No hay un token de autenticación disponible');
        setLoading(false);
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Realizar peticiones en paralelo para mejorar rendimiento
      setLoadingMessage('Cargando información de escuelas y cursos...');
      const [usersResponse, schoolsResponse, coursesResponse] = await Promise.all([
        axios.get(`${apiUrl}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${apiUrl}/api/schools`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${apiUrl}/api/courses`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      // Guardar todos los datos
      const rawUsers = usersResponse.data;
      const allSchools = schoolsResponse.data;
      const allCourses = coursesResponse.data;
      
      setLoadingMessage('Procesando registros de asistencia...');
      // Obtener registros de asistencia de manera separada
      const attendanceResponse = await axios.get(`${apiUrl}/api/attendance/records`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setLoadingMessage('Enriqueciendo datos de usuarios...');
      // Añadir propiedad isRegistered a todos los usuarios
      const allUsers = rawUsers.map((user: User) => ({...user, isRegistered: true}));
      
      // Identificar usuarios registrados y no registrados
      const registeredUsers = allUsers.filter((u: User) => u.role !== 'unregistered');
      const unregisteredUsers = allUsers.filter((u: User) => u.role === 'unregistered');
      
      
      
      
      // Enriquecer datos de usuarios con información de cursos y escuelas
      const enrichedUsers = await Promise.all(allUsers.map(async (user: User) => {
        try {
          // Obtener cursos matriculados
          const userCoursesResponse = await getUserCourses(user._id);
          const userCourseIds = userCoursesResponse.map((c: any) => c._id);
          
          // Determinar escuelas a partir de cursos
          const courseSchools = new Set<string>();
          userCoursesResponse.forEach((course: any) => {
            if (typeof course.school === 'string') {
              courseSchools.add(course.school);
            } else if (course.school && course.school._id) {
              courseSchools.add(course.school._id);
            }
          });
          
          // Asegurar que schools es un array
          const userSchools = [
            ...(user.schools || []),
            ...Array.from(courseSchools)
          ];
          
          // Eliminar duplicados de escuelas usando filter
          const uniqueSchools = userSchools.filter((value, index, self) => 
            self.findIndex(s => String(s) === String(value)) === index
          );
          
          // Crear array de schoolRoles si no existe
          let userSchoolRoles = user.schoolRoles || [];
          
          // Añadir schoolRoles implícitos basados en schools
          uniqueSchools.forEach(schoolId => {
            // Verificar si ya existe un rol para esta escuela
            const hasRoleForSchool = userSchoolRoles.some(sr => 
              typeof sr.schoolId === 'string' 
                ? sr.schoolId === schoolId
                : String(sr.schoolId) === schoolId
            );
            
            // Si no existe, agregar uno predeterminado
            if (!hasRoleForSchool) {
              userSchoolRoles.push({
                schoolId,
                role: user.role === 'unregistered' ? 'student' : user.role
              });
            }
          });
          
          return {
            ...user,
            enrolledCourses: userCourseIds,
            schools: uniqueSchools,
            schoolRoles: userSchoolRoles
          };
        } catch (error) {
          console.error(`Error enriqueciendo datos del usuario ${user.name}:`, error);
          return user;
        }
      }));
      
      
      
      // Actualizar el estado con los usuarios enriquecidos
      setUsers(enrichedUsers);
      setSchools(allSchools);
      setCourses(allCourses);
      setAttendanceRecords(attendanceResponse.data);
      
      // Procesar los registros de asistencia para extraer usuarios no registrados
      // Primero, esperar a que se complete la actualización de users
      setTimeout(() => {
        processAttendanceForUnregisteredUsers(attendanceResponse.data);
        
        // Si estamos en la vista de asistentes, asegurarnos de que se muestren
        if (selectedSchool === 'unregistered') {
          
        }
      }, 500); // pequeño retraso para asegurar que users esté actualizado
      
      // Filtrar escuelas asociadas al usuario actual
      if (user?.role === 'super_admin') {
        // Super admin ve todas las escuelas
        setUserSchools(allSchools);
      } else if (user?.role === 'school_owner' || user?.role === 'admin') {
        // Buscar el usuario actual en la lista para obtener sus schoolRoles
        const currentUserData = enrichedUsers.find((u: User) => u._id === user.sub);
        if (currentUserData) {
          // Filtrar escuelas según los roles y schools del usuario
          let associatedSchoolIds: string[] = [];
          
          // Añadir IDs de escuelas de schoolRoles
          if (currentUserData.schoolRoles) {
            associatedSchoolIds = [
              ...associatedSchoolIds,
              ...currentUserData.schoolRoles.map((sr: SchoolRole) => 
                typeof sr.schoolId === 'string' ? sr.schoolId : String(sr.schoolId)
              )
            ];
          }
          
          // Añadir IDs de escuelas de schools
          if (currentUserData.schools) {
            associatedSchoolIds = [
              ...associatedSchoolIds,
              ...currentUserData.schools.map((id: any) => 
                typeof id === 'string' ? id : String(id)
              )
            ];
          }
          
          // Eliminar duplicados de escuelas en el rol de usuario actual
          const uniqueSchoolIds = associatedSchoolIds.filter((value, index, self) => 
            self.findIndex(s => String(s) === String(value)) === index
          );
          
          const filteredSchools = allSchools.filter((school: School) => 
            uniqueSchoolIds.includes(school._id)
          );
          
          setUserSchools(filteredSchools);
          
          // Si el usuario solo está asociado a una escuela, seleccionarla automáticamente
          if (filteredSchools.length === 1) {
            setSelectedSchool(filteredSchools[0]._id);
          }
        } else {
          setUserSchools([]);
        }
      } else {
        setUserSchools([]);
      }
      
      // Configurar usuarios filtrados iniciales
      setFilteredUsers(enrichedUsers);
      
      // Calcular total de páginas basado en el número de usuarios
      setTotalPages(Math.ceil(enrichedUsers.length / itemsPerPage));
      
      // Establecer dataReady a true para indicar que los datos están completamente cargados
      setDataReady(true);
      
    } catch (error) {
      console.error('Error al obtener datos:', error);
      setError(handleApiError(error));
      setDataReady(false); // En caso de error, indicar que los datos no están listos
    } finally {
      // Pequeño retraso antes de ocultar el spinner para asegurar que la UI se actualice
      setTimeout(() => {
        setLoading(false);
      }, 300);
    }
  }, [handleApiError, getUserCourses, itemsPerPage, selectedSchool, user?.role, user?.sub]);

  // Cargar escuelas y cursos específicamente - definido con useCallback
  const loadSchoolsAndCourses = useCallback(async () => {
    try {
      setLoading(true); // Indicar carga
      setDataReady(false); // Indicar que los datos no están listos
      setLoadingMessage('Cargando escuelas y cursos...');
      
      const token = Cookies.get('token');
      if (!token) {
        setError('No hay un token de autenticación disponible');
        setDataReady(false);
        setTimeout(() => {
          setLoading(false);
        }, 300);
        return false;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Cargar escuelas
      const schoolsResponse = await axios.get(`${apiUrl}/api/schools`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Cargar cursos
      const coursesResponse = await axios.get(`${apiUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const allSchools = schoolsResponse.data;
      const allCourses = coursesResponse.data;
      
      // Actualizar estados
      setSchools(allSchools);
      setCourses(allCourses);
      
      // Determinar qué escuelas puede ver el usuario actual
      // Siempre permitimos ver todas las escuelas disponibles por ahora
      setUserSchools(allSchools);
      
      // Marcar que los datos están listos
      setDataReady(true);
      
      setTimeout(() => {
        setLoading(false);
      }, 300);
      return true;
    } catch (error) {
      console.error('Error al cargar escuelas y cursos:', error);
      setError(handleApiError(error));
      setDataReady(false);
      setTimeout(() => {
        setLoading(false);
      }, 300);
      return false;
    }
  }, [handleApiError]);

  // Verificar autenticación
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setUser(decoded);

      // Solo permitir acceso a administradores
      if (!['admin', 'super_admin', 'school_owner'].includes(decoded.role)) {
        router.push('/');
        return;
      }

      // Cargar datos iniciales
      fetchData();

    } catch (error) {
      console.error('Error al decodificar token:', error);
      Cookies.remove('token');
      router.push('/login');
    }
  }, [router, fetchData]);

  // Cargar escuelas y cursos cuando el usuario cambia
  useEffect(() => {
    if (user) {
      loadSchoolsAndCourses();
    }
  }, [user, loadSchoolsAndCourses]);

  // Extraer usuarios no registrados de los registros de asistencia
  const processAttendanceForUnregisteredUsers = useCallback((attendanceRecords: Attendance[]) => {
    setDataReady(false);
    setLoading(true);
    setLoadingMessage('Procesando asistentes...');
    
    const nonRegisteredAttendees = new Map();
    
    // Determinar si debemos filtrar por escuelas del usuario
    const shouldFilterBySchool = user?.role === 'school_owner' || user?.role === 'administrative';
    const userOwnedSchoolIds = userSchools.map(school => school._id);
    
    // Primero, buscar usuarios con role='unregistered' en la lista de usuarios general
    users.forEach(user => {
      if (user.role === 'unregistered') {
        // Para school_owner y administrative, filtrar solo los unregistered que pertenecen a sus escuelas
        if (shouldFilterBySchool) {
          // Verificar si el usuario no registrado está asociado con alguna escuela del usuario actual
          const userSchoolIds = user.schools || [];
          const hasSchoolAssociation = userSchoolIds.some(schoolId => 
            userOwnedSchoolIds.includes(typeof schoolId === 'string' 
              ? schoolId 
              : (schoolId as any).toString())
          );
          
          // Si el usuario no está asociado con ninguna escuela del owner/administrative, omitirlo
          if (!hasSchoolAssociation) {
            return;
          }
        }
        
        // Verificar si ya está en el mapa para evitar duplicados
        if (!nonRegisteredAttendees.has(user._id)) {
          nonRegisteredAttendees.set(user._id, {
            _id: user._id,
            name: user.name,
            isRegistered: false,
            role: 'unregistered',
            occurrences: 1,
            courses: user.enrolledCourses || [],
            schools: user.schools || [],
            lastSeen: user.createdAt || new Date()
          });
        }
      }
    });
    
    // Procesar registros de asistencia para encontrar usuarios no registrados que no estén en la base de datos
    if (attendanceRecords && attendanceRecords.length > 0) {
      // Para school_owner, necesitamos filtrar registros de asistencia por escuela también
      let filteredAttendanceRecords = attendanceRecords;
      
      if (shouldFilterBySchool) {
        // Filtrar registros de asistencia por las escuelas asociadas al curso
        filteredAttendanceRecords = attendanceRecords.filter(record => {
          // Si no tiene curso, no podemos saber a qué escuela pertenece
          if (!record.course) return false;
          
          // Buscar el curso para obtener la escuela
          const course = courses.find(c => c._id === record.course);
          if (!course) return false;
          
          // Verificar si la escuela del curso está entre las escuelas del school_owner
          const courseSchoolId = typeof course.school === 'string' 
            ? course.school 
            : (course.school as School)?._id;
            
          return userOwnedSchoolIds.includes(courseSchoolId);
        });
      }
      
      // Iterar sobre cada registro de asistencia (filtrado si es necesario)
      filteredAttendanceRecords.forEach(record => {
        // Solo procesar si el estudiante es un string (nombre) o si studentModel es 'String'
        const isNonRegistered = 
          typeof record.student === 'string' || 
          record.studentModel === 'String';
        
        if (isNonRegistered) {
          const studentName = typeof record.student === 'string' 
            ? record.student 
            : (record.student as any)?.name || 'Desconocido';
          
          let existingKey = null;
          
          // Buscar primero por nombre en los registros existentes
          Array.from(nonRegisteredAttendees.entries()).some(([key, value]) => {
            if (value.name === studentName) {
              existingKey = key;
              return true; // Detener la iteración
            }
            return false;
          });
          
          if (!existingKey) {
            // Primer registro para este estudiante - crear un ID temporal
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            nonRegisteredAttendees.set(tempId, {
              _id: tempId,
              name: studentName,
              isRegistered: false,
              role: 'unregistered',
              occurrences: 1,
              courses: record.course ? [record.course] : [],
              schools: [],
              lastSeen: new Date(record.date)
            });
          } else {
            // Actualizar registro existente
            const existingRecord = nonRegisteredAttendees.get(existingKey);
            existingRecord.occurrences += 1;
            
            // Añadir curso si no está ya incluido
            if (record.course && !existingRecord.courses.includes(record.course)) {
              existingRecord.courses.push(record.course);
            }
            
            // Actualizar fecha si es más reciente
            const recordDate = new Date(record.date);
            if (recordDate > existingRecord.lastSeen) {
              existingRecord.lastSeen = recordDate;
            }
          }
        }
      });
    }
    
    const nonRegisteredUsers = Array.from(nonRegisteredAttendees.values());
    
    if (nonRegisteredUsers.length > 0) {
      nonRegisteredUsers.slice(0, 3).forEach((user, index) => {
        
      });
    } else {
      
    }
    
    setUnregisteredUsers(nonRegisteredUsers);
    
    // Marcar que los datos están listos
    setDataReady(true);
    
    // Pequeño retraso antes de ocultar el spinner
    setTimeout(() => {
      setLoading(false);
    }, 300);
    
  }, [users, courses, userSchools, user?.role, user?.sub]);

  // Actualizar vista cuando cambie el filtro de escuela o búsqueda
  useEffect(() => {
    // Solo procesar los filtros si los datos están realmente cargados
    if (!dataReady) return;
    
    // Para mostrar asistentes sin registro
    if (selectedSchool === 'unregistered') {
      // Si no hay asistentes cargados y hay usuarios en la lista, reprocesar para encontrar asistentes
      if (unregisteredUsers.length === 0 && users.length > 0) {
        processAttendanceForUnregisteredUsers(attendanceRecords);
      }
      
      // No necesitamos actualizar filteredUsers ya que los asistentes se muestran directamente
      return;
    }
    
    // Para otros filtros, comenzar con todos los usuarios
    let filtered = users;
    
    // Si es un school_owner o administrative, solo mostrar usuarios de sus escuelas
    // Esto puede ser redundante con el filtrado del backend, pero es una capa adicional de seguridad
    if ((user?.role === 'school_owner' || user?.role === 'administrative') && userSchools.length > 0) {
      const userOwnedSchoolIds = userSchools.map(school => school._id);
      
      // Solo incluir usuarios asociados a las escuelas de este school_owner o administrative
      filtered = filtered.filter(user => {
        // Verificar asociaciones de escuela
        const userSchoolIds = user.schools || [];
        const hasSchoolAssociation = userSchoolIds.some(schoolId => 
          userOwnedSchoolIds.includes(typeof schoolId === 'string' 
            ? schoolId 
            : (schoolId as any).toString())
        );
        
        return hasSchoolAssociation;
      });
    }
    
    // Aplicar filtro de búsqueda
    if (searchTerm !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(lowerSearchTerm) ||
        user.email?.toLowerCase().includes(lowerSearchTerm) ||
        user.role?.toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    // Aplicar filtro de escuela
    if (selectedSchool !== '') {
      // Filtrar usuarios que pertenecen a la escuela seleccionada
      filtered = filtered.filter(user => {
        // Verificar en schoolRoles
        const inSchoolRoles = user.schoolRoles && 
          user.schoolRoles.some(sr => {
            const srSchoolId = typeof sr.schoolId === 'string' 
              ? sr.schoolId 
              : String(sr.schoolId);
            return srSchoolId === selectedSchool;
          });
        
        // Verificar en schools (para usuarios con array de schools)
        const inSchools = user.schools && 
          Array.isArray(user.schools) &&
          user.schools.some(schoolId => 
            typeof schoolId === 'string' 
              ? schoolId === selectedSchool
              : String(schoolId) === selectedSchool
          );
        
        // Verificar en los cursos del usuario
        let inCourses = false;
        if (user.enrolledCourses && Array.isArray(user.enrolledCourses) && user.enrolledCourses.length > 0) {
          // Verificar si alguno de los cursos matriculados pertenece a la escuela seleccionada
          inCourses = courses.some(course => 
            user.enrolledCourses?.includes(course._id) && 
            (
              (typeof course.school === 'string' && course.school === selectedSchool) ||
              (typeof course.school === 'object' && course.school?._id === selectedSchool)
            )
          );
        }
        
        const isAssociated = inSchoolRoles || inSchools || inCourses;
        
        // Incluir usuario si está asociado a la escuela por cualquier método
        return isAssociated;
      });
    }
    
    setFilteredUsers(filtered);
    
    // Actualizar total de páginas
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    
    // Resetear a la página 1 cuando cambian los filtros
    setCurrentPage(1);
    
  }, [searchTerm, users, selectedSchool, itemsPerPage, unregisteredUsers, courses, attendanceRecords, user?.role, userSchools, processAttendanceForUnregisteredUsers, dataReady]);

  // Manejar cambios en el formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Crear usuario
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      if (createUserType === UserType.REGISTERED) {
        // Crear usuario registrado con acceso a la plataforma
        const response = await axios.post(
          `${apiUrl}/api/users`, 
          {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            schoolId: formData.school || undefined,
            courseId: formData.course || undefined,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Actualizar la lista de usuarios
        setUsers(prev => [...prev, {...response.data, isRegistered: true}]);
        setSuccess(`Usuario ${formData.name} creado correctamente.`);
        
      } else {
        // Para usuarios no registrados, debemos crear directamente el usuario
        
        
        // Verificar que esté seleccionado un curso
        if (!formData.course) {
          setError('Debe seleccionar un curso para agregar un asistente.');
          setLoading(false);
          return;
        }
        
        // Crear asistente con una estructura muy simple para evitar conflictos
        const createUserData = {
          name: formData.name
        };
        
        // Verificar si debemos añadir curso o escuela
        if (formData.course) {
          Object.assign(createUserData, { courseId: formData.course });
        }
        
        if (formData.school) {
          Object.assign(createUserData, { schoolId: formData.school });
        }
        
        
        
        // Crear usuario no registrado usando el endpoint bypass
        const response = await axios.post(
          `${apiUrl}/api/users/bypass-assistant`, 
          createUserData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        
        
        // Añadir manualmente el usuario a la lista de no registrados para visualización inmediata
        const newUnregisteredUser = {
          _id: response.data._id,
          name: formData.name,
          isRegistered: false,
          role: 'unregistered',
          occurrences: 1,
          courses: [formData.course],
          lastSeen: new Date()
        };
        
        // Actualizar la lista de usuarios no registrados y cambiar a esa pestaña
        setUnregisteredUsers(prev => {
          // Verificar si ya existe un usuario con ese nombre para evitar duplicados
          const exists = prev.some(u => u.name === formData.name);
          if (exists) {
            return prev.map(u => u.name === formData.name ? newUnregisteredUser : u);
          } else {
            return [...prev, newUnregisteredUser];
          }
        });
        
        // También actualizar la lista de usuarios registrados
        setUsers(prev => [...prev, {...response.data, isRegistered: false}]);
        
        setSelectedSchool('unregistered'); // Cambiar inmediatamente a la pestaña de no registrados
        setSuccess(`Asistente ${formData.name} creado correctamente.`);
        
        // Recargar todos los datos para asegurar consistencia
        setTimeout(() => {
          fetchData().then(() => {
            // Asegurarnos de que permanezca en la pestaña de no registrados después de recargar
            setSelectedSchool('unregistered');
          });
        }, 1000);
      }
      
      // Cerrar el modal y limpiar el formulario
      setShowCreateUserModal(false);
      setFormData({
        name: '',
        email: '',
        role: 'student',
        password: '',
        school: '',
        course: '',
      });
      
    } catch (error: any) {
      // Mostrar mensaje de error más detallado y específico
      if (error.response && error.response.data) {
        if (error.response.data.message) {
          setError(`Error al crear usuario: ${error.response.data.message}`);
        } else if (error.response.data.error) {
          setError(`Error al crear usuario: ${error.response.data.error}`);
        } else {
          setError(`Error al crear usuario. Código: ${error.response.status}`);
        }
      } else if (error.message) {
        setError(`Error al crear usuario: ${error.message}`);
      } else {
        setError('Error desconocido al crear usuario');
      }
    } finally {
      setLoading(false);
    }
  };

  // Vincular usuario no registrado a una cuenta registrada
  const handleLinkUser = (unregisteredUser: any) => {
    setSelectedUserToLink(unregisteredUser);
    setShowLinkModal(true);
  };

  // Completar vinculación de usuario
  const completeUserLinking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Crear usuario con la información del no registrado
      const response = await axios.post(
        `${apiUrl}/api/users/with-courses`, 
        {
          user: {
            name: selectedUserToLink.name,
            email: formData.email,
            password: formData.password,
            role: 'student',
          },
          courses: selectedUserToLink.courses
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Actualizar registros de asistencia para vincular al nuevo usuario
      await axios.post(
        `${apiUrl}/api/attendance/link-user`,
        {
          unregisteredName: selectedUserToLink.name,
          userId: response.data._id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Actualizar listas
      setUsers(prev => [...prev, {...response.data, isRegistered: true}]);
      setUnregisteredUsers(prev => prev.filter(u => u.name !== selectedUserToLink.name));
      
      // Limpiar y cerrar
      setFormData(prev => ({...prev, email: '', password: ''}));
      setSelectedUserToLink(null);
      setShowLinkModal(false);
      
      // Recargar datos
      fetchData();
      
    } catch (error) {
      console.error('Error al vincular usuario:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Está seguro que desea eliminar al usuario ${userName}?`)) {
      return;
    }
    
    setLoading(true);
    
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      await axios.delete(`${apiUrl}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Actualizar lista de usuarios
      setUsers(prev => prev.filter(u => u._id !== userId));
      setSuccess(`Usuario ${userName} eliminado correctamente.`);
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  // Manejar edición de usuario
  const handleEditUser = (userToEdit: User) => {
    setSelectedUser(userToEdit);
    setFormData({
      name: userToEdit.name,
      email: userToEdit.email,
      role: userToEdit.role,
      password: '', // No incluir la contraseña actual por seguridad
      school: '',
      course: '',
    });
    setShowEditUserModal(true);
  };

  // Guardar cambios de usuario
  const handleSaveUserChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      if (!selectedUser) return;
      
      // If there's a password, update it separately first
      if (formData.password) {
        await axios.patch(
          `${apiUrl}/api/users/${selectedUser._id}/admin-password`,
          { password: formData.password },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      // Update other user data
      const response = await axios.patch(
        `${apiUrl}/api/users/${selectedUser._id}`, 
        {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Actualizar usuario en la lista
      setUsers(prev => prev.map(u => 
        u._id === selectedUser._id ? { ...response.data, isRegistered: true } : u
      ));
      
      setSuccess(`Usuario ${formData.name} actualizado correctamente.`);
      setShowEditUserModal(false);
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  // Mostrar modal para enrollar usuario
  const handleEnrollUser = async (userToEnroll: User) => {
    setSelectedUser(userToEnroll);
    setError(''); // Limpiar mensajes de error previos
    
    // Resetear el formulario
    setFormData(prev => ({
      ...prev,
      school: '',
      course: '',
    }));
    
    // Cargar escuelas y cursos disponibles
    setShowEnrollModal(true); // Mostrar el modal inmediatamente
    const loaded = await loadSchoolsAndCourses();
    
    if (!loaded) {
      // Mostrar mensaje de error solo si falla la carga
      setError('Error al cargar escuelas y cursos');
    }
  };

  // Actualizar contadores de cursos para un usuario específico
  const updateUserCourseCount = async (userId: string) => {
    try {
      // Buscar usuario en la lista actual
      const userIndex = users.findIndex(u => u._id === userId);
      if (userIndex === -1) return;
      
      // Obtener cursos actualizados
      const userCourses = await getUserCourses(userId);
      
      // Actualizar usuario en la lista
      setUsers(prev => {
        const updatedUsers = [...prev];
        updatedUsers[userIndex] = {
          ...updatedUsers[userIndex],
          enrolledCourses: userCourses.map((c: any) => c._id)
        };
        return updatedUsers;
      });
      
    } catch (error) {
      // Error silencioso
    }
  };

  // Enrollar usuario en curso
  const handleEnrollUserToCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      if (!selectedUser || !formData.course) return;
      
      // Usar el formato correcto del endpoint: /api/courses/:id/enroll/:studentId
      await axios.post(
        `${apiUrl}/api/courses/${formData.course}/enroll/${selectedUser._id}`, 
        {}, // Cuerpo vacío ya que los IDs van en la URL
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Actualizar usuario en la lista local
      setUsers(prev => prev.map(u => {
        if (u._id === selectedUser._id) {
          return {
            ...u,
            enrolledCourses: [...(u.enrolledCourses || []), formData.course]
          };
        }
        return u;
      }));
      
      // Actualizar el conteo de cursos para el usuario
      await updateUserCourseCount(selectedUser._id);
      
      setSuccess(`Usuario ${selectedUser.name} enrollado en el curso correctamente.`);
      setShowEnrollModal(false);
      
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSuccess(''), 3000);
      
      // Recargar datos para asegurar consistencia
      fetchData();
      
    } catch (error: any) {
      // Preparar mensaje de error detallado para mostrar en modal
      let message = 'Error desconocido al enrollar usuario';
      
      if (error.response && error.response.data) {
        if (error.response.data.message) {
          message = error.response.data.message;
          
          // Mejorar mensaje para usuario ya enrollado
          if (message.includes('already enrolled') || message.toLowerCase().includes('ya está inscrito')) {
            const courseName = courses.find(c => c._id === formData.course)?.title || 'este curso';
            message = `El usuario ${selectedUser?.name} ya está inscrito en ${courseName}.`;
          }
        } else if (error.response.data.error) {
          message = error.response.data.error;
        }
      } else if (error.message) {
        message = error.message;
      }
      
      // Mostrar error en modal
      setErrorMessage(message);
      setShowErrorModal(true);
      setShowEnrollModal(false); // Cerrar modal de enrollamiento
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de cursos según escuela seleccionada
  const getFilteredCourses = () => {
    if (!formData.school) return [];
    
    return courses.filter(course => 
      typeof course.school === 'string' 
        ? course.school === formData.school
        : course.school && (course.school as School)._id === formData.school
    );
  };

  // Actualizar las escuelas disponibles cuando cambie el rol del usuario
  useEffect(() => {
    if (user && schools.length > 0) {
      // Siempre permitimos ver todas las escuelas disponibles por ahora
      setUserSchools(schools);
    }
  }, [user, schools]);

  // Ver cursos de un usuario
  const handleViewUserCourses = async (userItem: User) => {
    setSelectedUser(userItem);
    setLoading(true);
    
    try {
      const courses = await getUserCourses(userItem._id);
      setUserCourses(courses);
      setShowUserCoursesModal(true);
    } catch (error) {
      console.error('Error al cargar cursos del usuario:', error);
      setErrorMessage('No se pudieron cargar los cursos del usuario.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Mostrar modal para registrar pago
  const handleShowPaymentModal = async (userItem: User) => {
    setSelectedUser(userItem);
    setLoading(true);
    
    try {
      // Cargar los cursos del usuario para mostrarlos en el modal
      const courses = await getUserCourses(userItem._id);
      setUserCourses(courses);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error al cargar cursos del usuario:', error);
      setErrorMessage('No se pudieron cargar los cursos del usuario.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Registrar un pago
  const handleRegisterPayment = async (userId: string, amount: number, notes: string, courseId?: string, month?: string) => {
    if (!courseId) {
      setErrorMessage('Debe seleccionar un curso para registrar el pago.');
      setShowErrorModal(true);
      return;
    }

    try {
      setLoading(true);
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Preparar información del mes para incluir en las notas si está disponible
      let paymentNotes = notes;
      if (month) {
        // Intentamos formatear el mes para mayor claridad
        try {
          const [year, monthNum] = month.split('-');
          const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
          const formattedMonth = date.toLocaleString('default', { month: 'long', year: 'numeric' });
          paymentNotes = `Pago para ${formattedMonth}. ${notes}`.trim();
        } catch (e) {
          // Si hay algún error, simplemente añadimos el mes en formato original
          paymentNotes = `Pago para ${month}. ${notes}`.trim();
        }
      }
      
      // Llamar al endpoint para registrar el pago
      await axios.post(
        `${apiUrl}/api/courses/${courseId}/enrollment/${userId}/payment`,
        { 
          amount, 
          notes: paymentNotes,
          month: month // Incluir el mes en la petición
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setShowPaymentModal(false);
      setSuccess('Pago registrado correctamente.');
      
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Error al registrar pago:', error);
      const errorMsg = handleApiError(error);
      setErrorMessage(errorMsg || 'Error al registrar el pago.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Función para manejar la selección de un usuario desde la búsqueda
  const handleUserSelected = (user: any) => {
    // Agregar el usuario al listado si no existe
    if (!users.some(u => u._id === user._id)) {
      setUsers([...users, user]);
      setFilteredUsers([...filteredUsers, user]);
      setSuccess(`Usuario "${user.name}" añadido al listado`);
      
      // Limpiar el mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } else {
      setError(`El usuario "${user.name}" ya está en el listado`);
      
      // Limpiar el mensaje de error después de 3 segundos
      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };

  // Función para abrir el modal de asignación de roles
  const handleAssignRole = (user: any) => {
    setSelectedUserForRole(user);
    setShowAssignRoleModal(true);
  };

  // Función para actualizar la lista después de asignar un rol
  const handleRoleAssigned = () => {
    // Recargar usuarios para mostrar roles actualizados
    fetchData();
    setSuccess('Rol asignado correctamente');
    
    // Limpiar el mensaje de éxito después de 3 segundos
    setTimeout(() => {
      setSuccess('');
    }, 3000);
  };

  // Función para truncar el email
  const truncateEmail = (email: string) => {
    if (!email) return '';
    
    // En móviles queremos truncar más agresivamente
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const extraSmallScreen = typeof window !== 'undefined' && window.innerWidth <= 480;
    
    // Longitud máxima ajustada según el tamaño de pantalla
    const maxLength = extraSmallScreen ? 15 : (isMobile ? 20 : 25);
    
    if (email.length <= maxLength) return email;
    
    const atIndex = email.indexOf('@');
    if (atIndex <= 0) return email;
    
    const username = email.substring(0, atIndex);
    const domain = email.substring(atIndex);
    
    // Diferentes estrategias de truncado según el tamaño de pantalla
    if (extraSmallScreen) {
      // En pantallas muy pequeñas, sólo mostrar parte del nombre y dominio
      const usernameLimit = Math.min(5, username.length);
      const domainLimit = Math.min(7, domain.length);
      return `${username.substring(0, usernameLimit)}...${domain.substring(0, domainLimit)}...`;
    }
    
    if (isMobile) {
      // En móviles, truncar más agresivamente
      const usernameLimit = Math.min(7, username.length);
      return `${username.substring(0, usernameLimit)}...${domain.length > 8 ? domain.substring(0, 8) + '...' : domain}`;
    }
    
    // En pantallas normales
    if (username.length <= 10) {
      return `${username}${domain.length > 10 ? domain.substring(0, 10) + '...' : domain}`;
    }
    
    return `${username.substring(0, 10)}...${domain.length > 10 ? domain.substring(0, 10) + '...' : domain}`;
  };

  // Función para manejar el clic en el email
  const handleEmailClick = (email: string) => {
    if (expandedEmail === email) {
      setExpandedEmail(null);
    } else {
      setExpandedEmail(email);
    }
  };

  return (
    <div className={dashboardStyles.container}>
      <div className={dashboardStyles.dashboardHeader}>
        <h1>Gestión de Usuarios</h1>
        <p>Búsqueda global: encuentra usuarios de todo el sistema para asignarles roles</p>
      </div>

      <div className={dashboardStyles.content}>
        <div className={dashboardStyles.sidebar}>
          <nav className={dashboardStyles.nav}>
            <Link href="/" className={dashboardStyles.navLink}>
              Inicio
            </Link>
            <Link href="/admin/dashboard" className={dashboardStyles.navLink}>
              Dashboard
            </Link>
            <Link href="/admin/users" className={`${dashboardStyles.navLink} ${dashboardStyles.active}`}>
              Usuarios
            </Link>
            <Link href="/admin/schools" className={dashboardStyles.navLink}>
              Escuelas
            </Link>
            <Link href="/admin/courses" className={dashboardStyles.navLink}>
              Cursos
            </Link>
            <Link href="/admin/subscriptions" className={dashboardStyles.navLink}>
              Suscripciones
            </Link>
            <Link href="/admin/stats" className={dashboardStyles.navLink}>
              Estadísticas
            </Link>
          </nav>
        </div>

        <div className={dashboardStyles.mainContent}>
          {/* Si está cargando y los datos no están listos, SOLO mostrar el spinner centrado en pantalla */}
          {loading && !dataReady ? (
            <div className={styles.fullPageSpinner}>
              <LoadingSpinner message={loadingMessage} />
            </div>
          ) : (
            /* Cuando no está cargando o los datos están listos, mostrar el contenido completo */
            <>
              <div className={styles.controlPanel}>
                {user?.role === 'super_admin' || user?.role === 'admin' || 
                  user?.role === 'school_owner' || user?.role === 'administrative' ? (
                  <div className={styles.searchFilterRow}>
                    <div className={styles.searchWrapper}>
                      <UserSearch 
                        onSelectUser={handleUserSelected}
                        onAssignRole={handleAssignRole}
                        availableSchools={userSchools}
                        selectedSchool={selectedSchool}
                      />
                    </div>
                    <div className={styles.filterWrapper}>
                      <select
                        className={styles.select}
                        value={selectedSchool}
                        onChange={(e) => setSelectedSchool(e.target.value)}
                      >
                        <option value="">Todas las escuelas</option>
                        <option value="unregistered">Asistentes sin registro</option>
                        {userSchools.map(school => (
                          <option key={school._id} value={school._id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : 
                  <div className={styles.noPermissionsMessage}>
                    No tienes permisos para gestionar usuarios.
                  </div>
                }
                
                <div className={styles.actionButtonsRow}>
                  <button 
                    className={styles.createButton}
                    onClick={() => {
                      setCreateUserType(UserType.REGISTERED);
                      setShowCreateUserModal(true);
                    }}
                  >
                    <FaUserPlus /> Crear Usuario
                  </button>
                  <button 
                    className={styles.altButton}
                    onClick={() => {
                      setCreateUserType(UserType.UNREGISTERED);
                      setShowCreateUserModal(true);
                    }}
                  >
                    <FaUserCheck /> Agregar Asistente
                  </button>
                </div>
              </div>
      
              {error && <div className={styles.error}>{error}</div>}
              {success && <div className={styles.success}>{success}</div>}
              
              {/* Tabla de usuarios */}
              {selectedSchool === 'unregistered' ? (
                // Mostrar tabla de asistentes sin registro
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Apariciones</th>
                        <th>Cursos</th>
                        <th>Última Asistencia</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unregisteredUsers.length > 0 ? (
                        unregisteredUsers
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((user) => (
                            <tr key={user._id}>
                              <td>{user.name} <span className={styles.tagNonRegistered}>Asistente</span></td>
                              <td>{user.occurrences || 1}</td>
                              <td>
                                {user.courses && user.courses.length > 0 ? (
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ marginRight: '5px' }}>
                                      <FaGraduationCap />
                                    </span>
                                    <span>{user.courses.length}</span>
                                    <button 
                                      className={styles.iconButton}
                                      onClick={() => handleViewUserCourses(user)}
                                      style={{ marginLeft: '8px' }}
                                    >
                                      <FaList />
                                    </button>
                                  </div>
                                ) : 'Sin cursos'}
                              </td>
                              <td>
                                {user.lastSeen ? new Date(user.lastSeen).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className={styles.actionButtons}>
                                <button 
                                  className={styles.iconButton}
                                  onClick={() => handleLinkUser(user)}
                                  title="Vincular a cuenta registrada"
                                  style={{
                                    backgroundColor: '#ebf8ff',
                                    color: '#3182ce',
                                    padding: '0.35rem',
                                    borderRadius: '4px',
                                    margin: '0 3px'
                                  }}
                                >
                                  <FaLink />
                                </button>
                                <button 
                                  className={`${styles.iconButton} ${styles.deleteButton}`}
                                  onClick={() => handleDeleteUser(user._id, user.name)}
                                  title="Eliminar"
                                  style={{
                                    backgroundColor: '#fed7d7',
                                    color: '#e53e3e',
                                    padding: '0.35rem',
                                    borderRadius: '4px',
                                    margin: '0 3px'
                                  }}
                                >
                                  <FaTrash />
                                </button>
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={5} className={styles.noResults}>
                            No se encontraron asistentes sin registro
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Mostrar tabla de usuarios registrados
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Cursos</th>
                        <th>Fecha Registro</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length > 0 ? (
                        filteredUsers
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((user) => (
                            <tr key={user._id}>
                              <td>{user.name}</td>
                              <td>
                                <div 
                                  onClick={() => handleEmailClick(user.email)}
                                  className={`${styles.emailContainer} ${expandedEmail === user.email ? styles.emailExpanded : ''}`}
                                  title="Clic para expandir/contraer"
                                >
                                  {expandedEmail === user.email ? user.email : truncateEmail(user.email)}
                                </div>
                              </td>
                              <td>
                                {user.role === 'super_admin' && (
                                  <span style={{ 
                                    backgroundColor: '#f6ad55', 
                                    color: '#7b341e',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    display: 'inline-block',
                                  }}>
                                    super_admin
                                  </span>
                                )}
                                {user.role === 'admin' && (
                                  <span style={{ 
                                    backgroundColor: '#fc8181', 
                                    color: '#742a2a',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    display: 'inline-block',
                                  }}>
                                    admin
                                  </span>
                                )}
                                {user.role === 'teacher' && (
                                  <span style={{ 
                                    backgroundColor: '#68d391', 
                                    color: '#276749',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    display: 'inline-block',
                                  }}>
                                    teacher
                                  </span>
                                )}
                                {user.role === 'school_owner' && (
                                  <span style={{ 
                                    backgroundColor: '#b794f4', 
                                    color: '#553c9a',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    display: 'inline-block',
                                  }}>
                                    school_owner
                                  </span>
                                )}
                                {user.role === 'administrative' && (
                                  <span style={{ 
                                    backgroundColor: '#9ae6b4', 
                                    color: '#276749',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    display: 'inline-block',
                                  }}>
                                    administrative
                                  </span>
                                )}
                                {user.role === 'student' && (
                                  <span style={{ 
                                    backgroundColor: '#63b3ed', 
                                    color: '#2c5282',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    display: 'inline-block',
                                  }}>
                                    student
                                  </span>
                                )}
                                {user.role === 'unregistered' && (
                                  <span style={{ 
                                    backgroundColor: '#718096', 
                                    color: '#1a202c',
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    display: 'inline-block',
                                  }}>
                                    unregistered
                                  </span>
                                )}
                              </td>
                              <td>
                                {user.enrolledCourses && user.enrolledCourses.length > 0 ? (
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ marginRight: '5px', fontSize: '1.1rem', color: '#4a5568' }}>
                                      <FaGraduationCap />
                                    </span>
                                    <span>{user.enrolledCourses.length}</span>
                                    <button 
                                      className={styles.iconButton}
                                      onClick={() => handleViewUserCourses(user)}
                                      style={{ 
                                        marginLeft: '8px',
                                        backgroundColor: '#ebf8ff',
                                        color: '#3182ce',
                                        padding: '0.25rem',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem'
                                      }}
                                    >
                                      <FaList />
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ marginRight: '5px', fontSize: '1.1rem', color: '#4a5568' }}>
                                      <FaGraduationCap />
                                    </span>
                                    <span>0</span>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <span style={{ marginRight: '5px' }}>
                                    <FaClock />
                                  </span>
                                  <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                                </div>
                              </td>
                              <td className={styles.actionButtons}>
                                <button 
                                  className={styles.iconButton}
                                  onClick={() => handleEditUser(user)}
                                  title="Editar"
                                  style={{
                                    backgroundColor: '#ebf8ff',
                                    color: '#3182ce',
                                    padding: '0.35rem',
                                    borderRadius: '4px',
                                    margin: '0 3px'
                                  }}
                                >
                                  <FaEdit />
                                </button>
                                <button 
                                  className={styles.iconButton}
                                  onClick={() => handleEnrollUser(user)}
                                  title="Enrollar en curso"
                                  style={{
                                    backgroundColor: '#edf2f7',
                                    color: '#4a5568',
                                    padding: '0.35rem',
                                    borderRadius: '4px',
                                    margin: '0 3px'
                                  }}
                                >
                                  <FaGraduationCap />
                                </button>
                                
                                <button 
                                  className={styles.iconButton}
                                  onClick={() => handleShowPaymentModal(user)}
                                  title="Registrar pago"
                                  style={{
                                    backgroundColor: '#c6f6d5',
                                    color: '#276749',
                                    padding: '0.35rem',
                                    borderRadius: '4px',
                                    margin: '0 3px'
                                  }}
                                >
                                  <FaMoneyBillWave />
                                </button>
                                
                                <button 
                                  className={`${styles.iconButton} ${styles.deleteButton}`}
                                  onClick={() => handleDeleteUser(user._id, user.name)}
                                  title="Eliminar"
                                  style={{
                                    backgroundColor: '#fed7d7',
                                    color: '#e53e3e',
                                    padding: '0.35rem',
                                    borderRadius: '4px',
                                    margin: '0 3px'
                                  }}
                                >
                                  <FaTrash />
                                </button>
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                          <td colSpan={6} className={styles.noResults}>
                            No se encontraron usuarios que coincidan con los criterios de búsqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Paginación */}
              {((selectedSchool === 'unregistered' && unregisteredUsers.length > 0) || 
                (selectedSchool !== 'unregistered' && filteredUsers.length > 0)) && (
                <div className={styles.pagination}>
                  <button 
                    className={styles.paginationButton}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    &laquo; Anterior
                  </button>
                  <span className={styles.pageInfo}>
                    Página {currentPage} de {totalPages}
                  </span>
                  <button 
                    className={styles.paginationButton}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    Siguiente &raquo;
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modales para crear usuario, editar, vincular, etc. */}
      {showCreateUserModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>{createUserType === UserType.REGISTERED ? 'Crear Usuario' : 'Agregar Asistente'}</h2>
            <form onSubmit={handleCreateUser} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Nombre:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={styles.input}
                  required
                />
              </div>
              
              {createUserType === UserType.REGISTERED && (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="email">Email:</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="password">Contraseña:</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={styles.input}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="role">Rol:</label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className={styles.select}
                      required
                    >
                      <option value="student">Estudiante</option>
                      <option value="teacher">Profesor</option>
                      <option value="administrative">Administrativo</option>
                      {user?.role === 'super_admin' && (
                        <>
                          <option value="admin">Administrador</option>
                          <option value="school_owner">Dueño de Escuela</option>
                        </>
                      )}
                    </select>
                  </div>
                </>
              )}
              
              {/* Escuela y Curso para ambos tipos de usuario */}
              <div className={styles.formGroup}>
                <label htmlFor="school">Escuela:</label>
                <select
                  id="school"
                  name="school"
                  value={formData.school}
                  onChange={handleInputChange}
                  className={styles.select}
                  required={createUserType === UserType.UNREGISTERED}
                >
                  <option value="">Seleccionar Escuela</option>
                  {schools.map(school => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {formData.school && (
                <div className={styles.formGroup}>
                  <label htmlFor="course">Curso:</label>
                  <select
                    id="course"
                    name="course"
                    value={formData.course}
                    onChange={handleInputChange}
                    className={styles.select}
                    required={createUserType === UserType.UNREGISTERED}
                  >
                    <option value="">Seleccionar Curso</option>
                    {getFilteredCourses().map(course => (
                      <option key={course._id} value={course._id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton}>
                  {createUserType === UserType.REGISTERED ? 'Crear Usuario' : 'Agregar Asistente'}
                </button>
                <button 
                  type="button" 
                  className={styles.cancelButton} 
                  onClick={() => setShowCreateUserModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal para editar usuario */}
      {showEditUserModal && selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Editar Usuario</h2>
            <form onSubmit={handleSaveUserChanges} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="edit-name">Nombre:</label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-email">Email:</label>
                <input
                  type="email"
                  id="edit-email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-role">Rol:</label>
                <select
                  id="edit-role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className={styles.select}
                  required
                >
                  <option value="student">Estudiante</option>
                  <option value="teacher">Profesor</option>
                  <option value="administrative">Administrativo</option>
                  {user?.role === 'super_admin' && (
                    <>
                      <option value="admin">Administrador</option>
                      <option value="school_owner">Dueño de Escuela</option>
                      {selectedUser._id !== user.sub && (
                        <option value="super_admin">Super Admin</option>
                      )}
                    </>
                  )}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="edit-password">Nueva Contraseña (dejar vacío para mantener):</label>
                <input
                  type="password"
                  id="edit-password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton}>
                  Guardar Cambios
                </button>
                <button 
                  type="button" 
                  className={styles.cancelButton} 
                  onClick={() => setShowEditUserModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal para vincular usuario no registrado */}
      {showLinkModal && selectedUserToLink && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Vincular Asistente a Cuenta</h2>
            <p className={styles.modalDescription}>
              Vincular al asistente <strong>{selectedUserToLink.name}</strong> a una nueva cuenta de usuario
            </p>
            <form onSubmit={completeUserLinking} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="link-email">Email:</label>
                <input
                  type="email"
                  id="link-email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="link-password">Contraseña:</label>
                <input
                  type="password"
                  id="link-password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton}>
                  Crear Cuenta y Vincular
                </button>
                <button 
                  type="button" 
                  className={styles.cancelButton} 
                  onClick={() => {
                    setShowLinkModal(false); 
                    setSelectedUserToLink(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal para mostrar errores */}
      {showErrorModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Error</h2>
            <p className={styles.error}>{errorMessage}</p>
            <div className={styles.formActions}>
              <button 
                className={styles.submitButton} 
                onClick={() => setShowErrorModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para enrollar usuario en curso */}
      {showEnrollModal && selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Enrollar Usuario en Curso</h2>
            <p className={styles.modalDescription}>
              Enrollar a <strong>{selectedUser.name}</strong> en un nuevo curso
            </p>
            <form onSubmit={handleEnrollUserToCourse} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="enroll-school">Escuela:</label>
                <select
                  id="enroll-school"
                  name="school"
                  value={formData.school}
                  onChange={handleInputChange}
                  className={styles.select}
                  required
                >
                  <option value="">Seleccionar Escuela</option>
                  {schools.map(school => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {formData.school && (
                <div className={styles.formGroup}>
                  <label htmlFor="enroll-course">Curso:</label>
                  <select
                    id="enroll-course"
                    name="course"
                    value={formData.course}
                    onChange={handleInputChange}
                    className={styles.select}
                    required
                  >
                    <option value="">Seleccionar Curso</option>
                    {getFilteredCourses().map(course => (
                      <option key={course._id} value={course._id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton}>
                  Enrollar
                </button>
                <button 
                  type="button" 
                  className={styles.cancelButton} 
                  onClick={() => setShowEnrollModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal para ver cursos del usuario */}
      {showUserCoursesModal && selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Cursos de {selectedUser.name}</h2>
            {userCourses.length > 0 ? (
              <div className={styles.coursesList}>
                <table className={styles.coursesTable}>
                  <thead>
                    <tr>
                      <th>Curso</th>
                      <th>Escuela</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userCourses.map(course => (
                      <tr key={course._id}>
                        <td>{course.title}</td>
                        <td>
                          {typeof course.school === 'string' 
                            ? schools.find(s => s._id === course.school)?.name || 'N/A' 
                            : course.school?.name || 'N/A'}
                        </td>
                        <td>
                          <span className={styles.activeStatus}>
                            <FaCheckCircle /> Activo
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Este usuario no está inscrito en ningún curso.</p>
            )}
            <div className={styles.formActions}>
              <button 
                className={styles.submitButton} 
                onClick={() => setShowUserCoursesModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal para registrar pago */}
      {showPaymentModal && selectedUser && (
        <PaymentRegistrationModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onRegisterPayment={(amount: number, notes: string, courseId?: string, month?: string) => 
            handleRegisterPayment(selectedUser._id, amount, notes, courseId, month)
          }
          courses={userCourses}
          user={selectedUser}
          onSelectCourse={(courseId: string) => setSelectedCourseId(courseId)}
        />
      )}
      
      {/* Modal para asignar rol en escuela */}
      {showAssignRoleModal && selectedUserForRole && (
        <AssignSchoolRoleModal
          isOpen={showAssignRoleModal}
          onClose={() => setShowAssignRoleModal(false)}
          onRoleAssigned={handleRoleAssigned}
          user={selectedUserForRole}
          schools={userSchools}
        />
      )}
    </div>
  );
} 