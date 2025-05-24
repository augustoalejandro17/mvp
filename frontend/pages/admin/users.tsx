import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/Admin.module.css';
import dashboardStyles from '../../styles/AdminDashboard.module.css';
import Link from 'next/link';
import { FaEdit, FaTrash, FaUserPlus, FaLink, FaUserCheck, FaSearch, FaClock, FaCheckCircle, FaEnvelope, FaUniversity, FaList, FaGraduationCap, FaCalendarAlt, FaMoneyBillWave } from 'react-icons/fa';
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

export default function UserManagement() {
  // Estados
  const [users, setUsers] = useState<User[]>([]);
  const [unregisteredUsers, setUnregisteredUsers] = useState<any[]>([]); // Usuarios sin registro
  const [loading, setLoading] = useState(true); // Este loading se puede refinar
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
  
  // Estados para el ordenamiento
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
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

  // Extraer usuarios no registrados de los registros de asistencia
  const processAttendanceForUnregisteredUsers = useCallback(
    (
      currentLocalUsers: User[], // Renombrado para claridad, representa el estado 'users'
      currentUserSchoolsData: School[], // Renombrado para claridad, representa el estado 'userSchools'
      attendanceData: Attendance[],
      initialUnregUsers: User[],
      courseData: Course[]
    ) => {
      console.log('[AdminUsers] Processing attendance for unregistered users...');
      
      const nonRegisteredAttendees = new Map();
      
      // Determinar si debemos filtrar por escuelas del usuario (basado en el estado 'user')
      const shouldFilterBySchool = user?.role === 'school_owner' || user?.role === 'administrative';
      // Usa currentUserSchoolsData (argumento) en lugar de userSchools (estado) para determinar los IDs
      const userOwnedSchoolIds = currentUserSchoolsData.map(school => school._id);
      
      // Usa currentLocalUsers (argumento) en lugar de users (estado)
      const combinedInitialUnregistered = [...currentLocalUsers.filter(u => u.role === 'unregistered'), ...initialUnregUsers];
      
      combinedInitialUnregistered.forEach(u => { // renombrado user a u para evitar conflicto con estado 'user'
        if (shouldFilterBySchool) {
          const userSchoolIds = u.schools || [];
          const hasSchoolAssociation = userSchoolIds.some(schoolId => 
            userOwnedSchoolIds.includes(typeof schoolId === 'string' 
              ? schoolId 
              : (schoolId as any).toString())
          );
          if (!hasSchoolAssociation) return;
        }
        
        if (!nonRegisteredAttendees.has(u._id)) {
          nonRegisteredAttendees.set(u._id, {
            _id: u._id,
            name: u.name,
            isRegistered: u.isRegistered !== undefined ? u.isRegistered : false,
            role: 'unregistered',
            occurrences: 1,
            courses: u.enrolledCourses || [],
            schools: u.schools || [],
            lastSeen: u.createdAt || new Date()
          });
        }
      });
      
      if (attendanceData && attendanceData.length > 0) {
        let filteredAttendanceRecords = attendanceData;
        
        if (shouldFilterBySchool) {
          filteredAttendanceRecords = attendanceData.filter(record => {
            if (!record.course) return false;
            const course = courseData.find(c => c._id === record.course);
            if (!course) return false;
            const courseSchoolId = typeof course.school === 'string' 
              ? course.school 
              : (course.school as School)?._id;
            return userOwnedSchoolIds.includes(courseSchoolId);
          });
        }
        
        filteredAttendanceRecords.forEach(record => {
          const isNonRegistered = 
            typeof record.student === 'string' || 
            record.studentModel === 'String';
          
          if (isNonRegistered) {
            const studentName = typeof record.student === 'string' 
              ? record.student 
              : (record.student as any)?.name || 'Desconocido';
            
            let existingKey = null;
            Array.from(nonRegisteredAttendees.entries()).some(([key, value]) => {
              if (value.name === studentName && value.role === 'unregistered') {
                existingKey = key;
                return true;
              }
              return false;
            });
            
            if (!existingKey) {
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2,9)}`;
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
              const existingRecord = nonRegisteredAttendees.get(existingKey);
              existingRecord.occurrences += 1;
              if (record.course && !existingRecord.courses.includes(record.course)) {
                existingRecord.courses.push(record.course);
              }
              const recordDate = new Date(record.date);
              if (recordDate > existingRecord.lastSeen) {
                existingRecord.lastSeen = recordDate;
              }
            }
            }
          });
      }
      
      const finalUnregisteredList = Array.from(nonRegisteredAttendees.values());
      setUnregisteredUsers(finalUnregisteredList);
      console.log('[AdminUsers] Unregistered users state updated count:', finalUnregisteredList.length);
    },
    [setUnregisteredUsers, user?.role, user?.sub] // Dependencias más estables
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(async () => {
    console.log('[AdminUsers] useEffect[] -> fetchData CALLED');
    try {
      setLoading(true);
      setDataReady(false);
      
      const token = Cookies.get('token');
      if (!token) {
        setError('No hay un token de autenticación disponible');
        setLoading(false);
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // 1. Fetch Users
      const usersResponse = await axios.get(`${apiUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rawUsers = usersResponse.data.users || usersResponse.data; // Adapt based on actual API response
      const allUsers = rawUsers.map((user: User) => ({...user, isRegistered: true}));
      setUsers(allUsers);
      
      setLoading(false);
      setDataReady(true); // Datos de usuarios principales listos
      setError(''); // Clear any previous error

    } catch (err: any) {
      console.error("Error in fetchData:", err);
      console.error("fetchData error details:", err.response?.data || err.message || err);
      setError(err.message || 'Error al cargar datos de usuarios.');
      setLoading(false);
      setDataReady(false); // Ensure dataReady is false on error
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUsers, setLoading, setDataReady, setError]); // Explicitly list state setters

  // Renamed and refactored from fetchSecondaryData
  const fetchSecondaryDataAndProcess = useCallback(async () => {
    console.log('[AdminUsers] fetchSecondaryDataAndProcess CALLED');
    const token = Cookies.get('token');
    if (!token || !user || users.length === 0) { // Ensure primary data is ready
      console.log('[AdminUsers] fetchSecondaryDataAndProcess skipped: token, user, or users not ready');
      return;
    }
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    console.log('[AdminUsers] Fetching secondary data...');

    try {
      // setLoading(true); // Consider if a separate loading for secondary is needed
      const [schoolsResponse, coursesResponse, attendanceResponse, rawUnregisteredUsersResponse] = await Promise.all([
        axios.get(`${apiUrl}/api/schools`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${apiUrl}/api/courses`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${apiUrl}/api/attendance/all-records-admin`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${apiUrl}/api/users/unregistered`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const fetchedSchools = schoolsResponse.data.schools || schoolsResponse.data;
      const fetchedCourses = coursesResponse.data;
      const fetchedAttendanceRecords = attendanceResponse.data;
      const initialUnregisteredUsersFromAPI = rawUnregisteredUsersResponse.data;

      console.log('[AdminUsers] Fetched Schools:', fetchedSchools);
      // console.log('[AdminUsers] Fetched Courses:', fetchedCourses); // Can be noisy
      console.log('[AdminUsers] Fetched Attendance Records count:', fetchedAttendanceRecords?.length);
      console.log('[AdminUsers] Fetched Initial Unregistered Users from API count:', initialUnregisteredUsersFromAPI?.length);

      setSchools(fetchedSchools);
      setUserSchools(fetchedSchools); // This will be used by processAttendance...
      setCourses(fetchedCourses);
      setAttendanceRecords(fetchedAttendanceRecords);
      
      // Pass the current 'users' state and the just-fetched 'fetchedSchools'
      processAttendanceForUnregisteredUsers(
        users, // current 'users' state from fetchData
        fetchedSchools, // use the schools we just fetched
        fetchedAttendanceRecords,
        initialUnregisteredUsersFromAPI,
        fetchedCourses
      );

      console.log('[AdminUsers] Secondary data processing finished.');
      // setDataReady(true); // Or a more specific ready flag
    } catch (err) {
      console.error("[AdminUsers] Error fetching secondary data:", err);
      setError('Error al cargar datos adicionales.'); 
    } finally {
      // setLoading(false); // Match setLoading(true) if used
    }
  }, [user, users, processAttendanceForUnregisteredUsers, setSchools, setUserSchools, setCourses, setAttendanceRecords, setError]); // Dependencies

  // Cargar escuelas y cursos específicamente - definido con useCallback
  const loadSchoolsAndCourses = useCallback(async () => {
    try {
      setLoading(true); // Indicar carga
      setDataReady(false); // Indicar que los datos no están listos
      
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
      
      const allSchools = schoolsResponse.data.schools || schoolsResponse.data; // Adaptar por si la API devuelve {schools: []} o solo []
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
  }, [handleApiError, setLoading, setDataReady, setError, setSchools, setCourses, setUserSchools]); // Added state setters

  // useEffect for initial token decoding and primary data fetch
  useEffect(() => {
    console.log('[AdminUsers] Initial useEffect (token & primary data) CALLED');
    const token = Cookies.get('token');
    if (token) {
      try {
        const decodedToken = jwtDecode<DecodedToken>(token);
        setUser(decodedToken); // Set user state
        fetchData(); // Fetch primary users
      } catch (e: any) {
        console.error("Failed to decode token:", e);
        console.error("Token decoding error details:", e.message || e);
        setError("Token inválido o expirado.");
      router.push('/login');
      }
    } else {
      router.push('/login');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, router]); // Only depends on fetchData and router (stable)

  // useEffect for secondary data fetching and processing
  // Runs after 'user' (decoded token) and 'users' (primary user list) are populated
  useEffect(() => {
    console.log('[AdminUsers] Secondary data useEffect CALLED (dependencies: user, users, fetchSecondaryDataAndProcess)');
    if (user && users.length > 0) {
      fetchSecondaryDataAndProcess();
          } else {
      console.log('[AdminUsers] Secondary data useEffect skipped: user or users not ready.');
            }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, users, fetchSecondaryDataAndProcess]);
    
  // useEffect para filtrar usuarios cuando cambia el término de búsqueda o la escuela seleccionada
  useEffect(() => {
    let tempUsers = users;

    if (selectedSchool && selectedSchool !== 'all' && selectedSchool !== 'unregistered') {
      tempUsers = tempUsers.filter(user => 
        user.schoolRoles?.some(sr => sr.schoolId === selectedSchool) || 
        user.schools?.includes(selectedSchool)
      );
    }
    
    // Aplicar filtro de búsqueda por término
    if (searchTerm) {
      tempUsers = tempUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) // Verificar si email existe
      );
    }
    
    setFilteredUsers(tempUsers);
    setCurrentPage(1); // Resetear a la primera página con cada filtro
  }, [searchTerm, users, selectedSchool]);
        
  // Actualizar totalPages cuando cambia el ordenamiento o los filtros
  useEffect(() => {
    if (selectedSchool === 'unregistered') {
      setTotalPages(Math.ceil(unregisteredUsers.length / itemsPerPage));
    } else {
      setTotalPages(Math.ceil(filteredUsers.length / itemsPerPage)); // Usar filteredUsers aquí
    }
    setCurrentPage(1); // Resetear a la primera página con cada cambio que afecte el total de páginas
  }, [filteredUsers, unregisteredUsers, selectedSchool, itemsPerPage, sortBy, sortOrder]); // Agregado sortBy y sortOrder

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

  // Función para manejar el ordenamiento
  const handleSort = (field: string) => {
    // Si se hace clic en el mismo campo, invertir el orden
    if (field === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Si se hace clic en un campo diferente, establecer ese campo y ordenar ascendente
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Función para aplicar el ordenamiento a los usuarios
  const getSortedUsers = useCallback((users: User[]) => {
    if (!users || users.length === 0) return [];
    
    return [...users].sort((a, b) => {
      let valueA: string | number;
      let valueB: string | number;
      
      switch (sortBy) {
        case 'name':
          valueA = a.name?.toLowerCase() || '';
          valueB = b.name?.toLowerCase() || '';
          break;
        case 'email':
          valueA = a.email?.toLowerCase() || '';
          valueB = b.email?.toLowerCase() || '';
          break;
        case 'role':
          valueA = a.role?.toLowerCase() || '';
          valueB = b.role?.toLowerCase() || '';
          break;
        case 'date':
          valueA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          valueB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          valueA = a.name?.toLowerCase() || '';
          valueB = b.name?.toLowerCase() || '';
      }
      
      // Para valores de texto
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortOrder === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      
      // Para valores numéricos y fechas
      const numA = valueA as number;
      const numB = valueB as number;
      return sortOrder === 'asc' ? (numA - numB) : (numB - numA);
    });
  }, [sortBy, sortOrder]);

  // Obtener usuarios ordenados para mostrar en la tabla
  const sortedFilteredUsers = useMemo(() => {
    return getSortedUsers(filteredUsers);
  }, [filteredUsers, getSortedUsers]);

  // Función para mostrar icono de dirección en las cabeceras de tabla
  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    
    return (
      <span className={styles.sortIcon}>
        {sortOrder === 'asc' ? ' ▲' : ' ▼'}
      </span>
    );
  };

  if (error && !users.length && !unregisteredUsers.length && !dataReady) {
    return <div className={dashboardStyles.centeredMessage}>Error al cargar datos: {error}. Intente recargar la página.</div>;
  }

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
          {/* El contenido principal (el fragmento <>) comienza inmediatamente aquí dentro */}
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
                    <div className={styles.sortControls}>
                      <label htmlFor="sortBy">Ordenar:</label>
                      <select 
                        id="sortBy"
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value);
                          setSortOrder('asc');
                        }}
                        className={styles.select}
                      >
                        <option value="name">Nombre</option>
                        <option value="email">Email</option>
                        <option value="role">Rol</option>
                        <option value="date">Fecha</option>
                      </select>
                      
                      <button 
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className={`${styles.iconButton} ${styles.sortDirectionButton}`}
                        title={`Orden ${sortOrder === 'asc' ? 'ascendente' : 'descendente'}`}
                      >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </button>
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
                        <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                          Nombre {renderSortIcon('name')}
                        </th>
                        <th onClick={() => handleSort('email')} className={styles.sortableHeader}>
                          Email {renderSortIcon('email')}
                        </th>
                        <th onClick={() => handleSort('role')} className={styles.sortableHeader}>
                          Rol {renderSortIcon('role')}
                        </th>
                        <th>Cursos</th>
                        <th onClick={() => handleSort('date')} className={styles.sortableHeader}>
                          Fecha Registro {renderSortIcon('date')}
                        </th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                    {!loading && sortedFilteredUsers.length > 0 ? (
                        sortedFilteredUsers
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((user) => (
                            <tr key={user._id}>
                            <td>
                              <Link href={`/admin/users/${user._id}`} className={styles.userNameLink}>
                                {user.name}
                              </Link>
                            </td>
                            <td 
                              title={user.email} 
                                  onClick={() => handleEmailClick(user.email)}
                              className={styles.emailCell}
                                >
                                  {expandedEmail === user.email ? user.email : truncateEmail(user.email)}
                              </td>
                              <td>
                              <span className={`${styles.roleBadge} ${styles[user.role.replace(/_/g, '')]}`}>
                                {user.role.replace(/_/g, ' ')}
                                  </span>
                              {user.isRegistered === false && (
                                <span className={`${styles.roleBadge} ${styles.unregistered}`}>no registrado</span>
                                )}
                              </td>
                              <td>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ marginRight: '5px', fontSize: '1.1rem', color: '#4a5568' }} title="Cursos matriculados">
                                      <FaGraduationCap />
                                    </span>
                                <span>{user.enrolledCourses?.length || 0}</span>
                                    <button 
                                      onClick={() => handleViewUserCourses(user)}
                                  className={`${styles.iconButton} ${styles.viewCoursesButton}`} 
                                  title="Ver cursos"
                                  style={{ marginLeft: '8px'}} /* Estilo básico, puede ser mejorado con CSS module */
                                    >
                                      <FaList />
                                    </button>
                                  </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ marginRight: '5px' }} title="Fecha de registro">
                                    <FaClock />
                                  </span>
                                  <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                                </div>
                              </td>
                            <td>
                              <button onClick={() => handleEditUser(user)} className={`${styles.iconButton} ${styles.editButton}`} title="Editar Usuario">
                                  <FaEdit />
                                </button>
                              {user.isRegistered !== false && (
                                <>
                                  <button onClick={() => handleEnrollUser(user)} className={`${styles.iconButton} ${styles.enrollButton}`} title="Matricular en Curso">
                                    <FaUserPlus />
                                </button>
                                  <button onClick={() => handleShowPaymentModal(user)} className={`${styles.iconButton} ${styles.paymentButton}`} title="Registrar Pago">
                                  <FaMoneyBillWave />
                                </button>
                                </>
                              )}
                              {user.isRegistered === false && selectedSchool === 'unregistered' && (
                                <button onClick={() => handleLinkUser(user)} className={`${styles.iconButton} ${styles.linkButton}`} title="Vincular con Usuario Registrado">
                                  <FaLink />
                                </button>
                              )}
                              <button onClick={() => handleDeleteUser(user._id, user.name)} className={`${styles.iconButton} ${styles.deleteButton}`} title="Eliminar Usuario">
                                  <FaTrash />
                                </button>
                              </td>
                            </tr>
                          ))
                      ) : (
                        <tr>
                        <td colSpan={6} className={styles.noDataMessage}>
                          {loading ? 'Cargando usuarios...' : 'No se encontraron usuarios que coincidan con los criterios de búsqueda.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Paginación */}
              {((selectedSchool === 'unregistered' && unregisteredUsers.length > 0) || 
                (selectedSchool !== 'unregistered' && sortedFilteredUsers.length > 0)) && (
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