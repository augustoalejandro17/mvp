import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/Admin.module.css';
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
  const [loading, setLoading] = useState(true);
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
  }, [router]);

  // Cargar escuelas y cursos cuando el usuario cambia
  useEffect(() => {
    if (user) {
      loadSchoolsAndCourses();
    }
  }, [user]);

  // Obtener datos iniciales
  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      if (!token) {
        setError('No hay un token de autenticación disponible');
        setLoading(false);
        return;
      }
      
      // Obtener usuarios registrados
      
      const usersResponse = await axios.get(`${apiUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Obtener escuelas
      
      const schoolsResponse = await axios.get(`${apiUrl}/api/schools`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      
      // Obtener cursos
      
      const coursesResponse = await axios.get(`${apiUrl}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      
      // Obtener registros de asistencia para extraer usuarios no registrados
      
      const attendanceResponse = await axios.get(`${apiUrl}/api/attendance/records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      

      // Guardar todos los datos
      const allUsers = usersResponse.data.map((user: User) => ({...user, isRegistered: true}));
      const allSchools = schoolsResponse.data;
      const allCourses = coursesResponse.data;
      
      
      
      
      
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
      
    } catch (error) {
      console.error('Error al obtener datos:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  // Extraer usuarios no registrados de los registros de asistencia
  const processAttendanceForUnregisteredUsers = (attendanceRecords: Attendance[]) => {
    
    const nonRegisteredAttendees = new Map();
    
    // Primero, buscar usuarios con role='unregistered' en la lista de usuarios general
    
    
    users.forEach(user => {
      if (user.role === 'unregistered') {
        
        
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
      
      
      // Iterar sobre cada registro de asistencia
      attendanceRecords.forEach(record => {
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
  };

  // Actualizar vista cuando cambie el filtro de escuela o búsqueda
  useEffect(() => {
    
    
    if (selectedSchool === 'unregistered') {
      
      // Si no hay asistentes cargados y hay usuarios en la lista, reprocesar para encontrar asistentes
      if (unregisteredUsers.length === 0 && users.length > 0) {
        
        processAttendanceForUnregisteredUsers(attendanceRecords);
      }
      return;
    }
    
    // Para otros filtros, comenzar con todos los usuarios
    let filtered = users;
    
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
        
        // Debug para verificar asignaciones de escuela
        if (isAssociated) {
          // Se incluye el usuario
        }
        
        // Incluir usuario si está asociado a la escuela por cualquier método
        return isAssociated;
      });
      
      
    }
    
    setFilteredUsers(filtered);
    
    // Actualizar total de páginas
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    
    // Resetear a la página 1 cuando cambian los filtros
    setCurrentPage(1);
    
  }, [searchTerm, users, selectedSchool, itemsPerPage, unregisteredUsers, courses, attendanceRecords]);

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
      
      const response = await axios.put(
        `${apiUrl}/api/users/${selectedUser._id}`, 
        {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          ...(formData.password ? { password: formData.password } : {}),
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

  // Cargar escuelas y cursos específicamente
  const loadSchoolsAndCourses = async () => {
    try {
      setLoading(true); // Indicar carga
      const token = Cookies.get('token');
      if (!token) {
        setError('No hay un token de autenticación disponible');
        setLoading(false);
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
      
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Error al cargar escuelas y cursos:', error);
      setError(handleApiError(error));
      setLoading(false);
      return false;
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

  // Obtener cursos de un usuario específico
  const getUserCourses = async (userId: string) => {
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

  if (loading && users.length === 0) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Gestión de Usuarios</h1>
        </div>

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
          ) : (
            <div className={styles.searchFilterRow}>
              <div className={styles.searchWrapper}>
                <div className={styles.simpleSearchWrapper}>
                  <input
                    type="text"
                    placeholder="Buscar usuarios..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                  <FaSearch className={styles.searchIcon} />
                </div>
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
          )}
          
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
        
        {/* Componente de depuración - solo visible para superadmin cuando hay problemas */}
        {user?.role === 'super_admin' && 
         selectedSchool === 'unregistered' && 
         unregisteredUsers.length === 0 && 
         users.some(u => u.role === 'unregistered') && (
          <div className={styles.debugInfo} style={{ 
            background: '#f8f9fa', 
            border: '1px solid #dee2e6',
            padding: '15px',
            borderRadius: '4px',
            marginBottom: '15px',
            fontSize: '0.9rem'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#4a5568' }}>Información de Depuración</h3>
            <p style={{ margin: '0 0 10px 0' }}>
              Se detectaron <strong>{users.filter(u => u.role === 'unregistered').length}</strong> asistentes en la base de datos, 
              pero no se están mostrando en la vista.
            </p>
            <button 
              onClick={() => {
                
                // Forzar actualización de ambos
                processAttendanceForUnregisteredUsers(attendanceRecords);
                // También recargar todos los datos
                fetchData();
              }}
              style={{
                padding: '8px 15px',
                background: '#3182ce',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Forzar recarga de asistentes
            </button>
          </div>
        )}

        <div className={styles.tableContainer}>
          {selectedSchool === 'unregistered' ? (
            // Tabla de usuarios no registrados
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  {user?.role === 'super_admin' && (
                    <>
                      <th>Asistencias</th>
                      <th>Cursos</th>
                      <th>Escuela</th>
                      <th>Última Asistencia</th>
                    </>
                  )}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {unregisteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'super_admin' ? 6 : 2} className={styles.emptyMessage}>
                      No hay asistentes sin registro en el sistema.
                      {users.some(u => u.role === 'unregistered') && (
                        <div style={{ marginTop: '10px', fontStyle: 'italic' }}>
                          Hay asistentes en la base de datos, pero no se están mostrando.
                          <button 
                            onClick={() => processAttendanceForUnregisteredUsers(attendanceRecords)}
                            style={{
                              marginLeft: '10px',
                              padding: '5px 10px',
                              background: '#3182ce',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Recargar asistentes
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  unregisteredUsers.map((nonRegUser, index) => (
                    <tr key={index} className={styles.nonRegistered}>
                      <td>
                        <div style={{ fontWeight: '500' }}>
                          {nonRegUser.name}
                          <span className={styles.tagNonRegistered}>No Registrado</span>
                        </div>
                      </td>
                      {user?.role === 'super_admin' && (
                        <>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <FaCheckCircle style={{ marginRight: '0.5rem', color: '#68d391' }} />
                              {nonRegUser.occurrences || 1}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <FaUniversity style={{ marginRight: '0.5rem', opacity: '0.6' }} />
                              {Array.isArray(nonRegUser.courses) ? nonRegUser.courses.length : 0}
                              {Array.isArray(nonRegUser.courses) && nonRegUser.courses.length > 0 && (
                                <button 
                                  className={styles.iconButton}
                                  title="Ver cursos"
                                  onClick={() => handleViewUserCourses({
                                    ...nonRegUser,
                                    _id: nonRegUser._id || 'temp-id',
                                    email: '',
                                    role: 'unregistered',
                                    enrolledCourses: nonRegUser.courses
                                  } as User)}
                                  style={{ marginLeft: '5px', color: '#3182ce' }}
                                >
                                  <FaList />
                                </button>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <FaUniversity style={{ marginRight: '0.5rem', color: '#4299e1' }} />
                              {nonRegUser.schools && nonRegUser.schools.length > 0 ? 
                                schools.find(s => nonRegUser.schools?.includes(s._id))?.name || 'Sin escuela' : 
                                'Sin escuela'}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <FaClock style={{ marginRight: '0.5rem', color: '#718096' }} />
                              {nonRegUser.lastSeen ? new Date(nonRegUser.lastSeen).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'}) : 'N/A'}
                            </div>
                          </td>
                        </>
                      )}
                      <td>
                        <button 
                          className={styles.iconButton}
                          onClick={() => handleLinkUser(nonRegUser)}
                          title="Vincular a cuenta registrada"
                        >
                          <FaLink />
                        </button>
                        <button 
                          className={styles.iconButton}
                          title="Registrar pago"
                          onClick={() => handleShowPaymentModal({
                            ...nonRegUser,
                            _id: nonRegUser._id || 'temp-id',
                            email: '',
                            role: 'unregistered',
                            enrolledCourses: nonRegUser.courses
                          } as User)}
                          style={{ color: '#38a169' }}
                        >
                          <FaMoneyBillWave />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            // Tabla de usuarios registrados con paginación
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    {user?.role === 'super_admin' && (
                      <>
                        <th>Rol</th>
                        <th>Cursos</th>
                        <th>Fecha Registro</th>
                      </>
                    )}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={user?.role === 'super_admin' ? 6 : 3} className={styles.emptyMessage}>
                        No se encontraron usuarios.
                      </td>
                    </tr>
                  ) : (
                    // Aplicar paginación a los usuarios filtrados
                    filteredUsers
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map(userItem => (
                        <tr key={userItem._id}>
                          <td>
                            <div style={{ fontWeight: '500' }}>
                              {userItem.name}
                              {userItem.role === 'unregistered' && 
                                <span className={styles.tagNonRegistered} style={{ marginLeft: '5px' }}>Asistente</span>}
                            </div>
                          </td>
                          <td>{userItem.email}</td>
                          {user?.role === 'super_admin' && (
                            <>
                              <td>
                                <span className={`${styles.roleBadge} ${styles[userItem.role]}`}>
                                  {userItem.role}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <FaUniversity style={{ marginRight: '0.5rem', opacity: '0.6' }} />
                                  {Array.isArray(userItem.enrolledCourses) ? userItem.enrolledCourses.length : 0}
                                  {Array.isArray(userItem.enrolledCourses) && userItem.enrolledCourses.length > 0 && (
                                    <button 
                                      className={styles.iconButton}
                                      title="Ver cursos"
                                      onClick={() => handleViewUserCourses(userItem)}
                                      style={{ marginLeft: '5px', color: '#3182ce' }}
                                    >
                                      <FaList />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <FaClock style={{ marginRight: '0.5rem', color: '#718096' }} />
                                  {userItem.createdAt ? new Date(userItem.createdAt).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'}) : 'N/A'}
                                </div>
                              </td>
                            </>
                          )}
                          <td>
                            <div className={styles.actionButtons}>
                              <button 
                                className={styles.iconButton}
                                title="Editar usuario"
                                onClick={() => handleEditUser(userItem)}
                              >
                                <FaEdit />
                              </button>
                              <button 
                                className={styles.iconButton}
                                title="Enrollar en curso"
                                onClick={() => handleEnrollUser(userItem)}
                              >
                                <FaUniversity />
                              </button>
                              <button 
                                className={styles.iconButton}
                                title="Registrar pago"
                                onClick={() => handleShowPaymentModal(userItem)}
                                style={{ color: '#38a169' }}
                              >
                                <FaMoneyBillWave />
                              </button>
                              {user?.role === 'super_admin' && (
                                <button 
                                  className={`${styles.iconButton} ${styles.deleteButton}`}
                                  title="Eliminar usuario"
                                  onClick={() => handleDeleteUser(userItem._id, userItem.name)}
                                >
                                  <FaTrash />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
              
              {/* Controles de paginación */}
              {filteredUsers.length > 0 && (
                <div className={styles.pagination}>
                  <div className={styles.paginationControls}>
                    <button 
                      className={styles.paginationButton}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </button>
                    <span className={styles.pageInfo}>
                      Página {currentPage} de {totalPages}
                    </span>
                    <button 
                      className={styles.paginationButton}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </button>
                  </div>
                  <div className={styles.itemsPerPageControl}>
                    <label htmlFor="itemsPerPage">Por página:</label>
                    <select
                      id="itemsPerPage"
                      className={styles.select}
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      style={{ width: '80px', marginLeft: '8px' }}
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal Crear Usuario */}
      {showCreateUserModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>
              {createUserType === UserType.REGISTERED ? 'Crear Usuario con Acceso' : 'Agregar Asistente sin Registro'}
            </h2>
            
            {error && <div className={styles.error} style={{ marginBottom: '1rem' }}>{error}</div>}
            
            <form onSubmit={handleCreateUser} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Nombre completo*</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                />
              </div>

              {createUserType === UserType.REGISTERED && (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="email">Email*</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="password">Contraseña temporal*</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className={styles.input}
                    />
                    <small>El usuario deberá cambiarla en su primer inicio de sesión</small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="role">Rol*</label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      required
                      className={styles.select}
                    >
                      <option value="student">Estudiante</option>
                      <option value="teacher">Profesor</option>
                      {user?.role === 'super_admin' && (
                        <>
                          <option value="admin">Administrador</option>
                          <option value="school_owner">Propietario de Escuela</option>
                          <option value="super_admin">Super Administrador</option>
                        </>
                      )}
                      {user?.role === 'admin' && (
                        <option value="admin">Administrador</option>
                      )}
                    </select>
                  </div>
                </>
              )}

              <div className={styles.formGroup}>
                <label htmlFor="school">Escuela {createUserType === UserType.REGISTERED ? '(opcional)' : ''}</label>
                <select
                  id="school"
                  name="school"
                  value={formData.school}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev, 
                      school: e.target.value,
                      course: '' // Resetear curso al cambiar escuela
                    }));
                  }}
                  className={styles.select}
                >
                  <option value="">Seleccionar escuela</option>
                  {userSchools.map(school => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="course">Curso {createUserType === UserType.REGISTERED ? '(opcional)' : ''}</label>
                <select
                  id="course"
                  name="course"
                  value={formData.course}
                  onChange={handleInputChange}
                  className={styles.select}
                  disabled={!formData.school}
                >
                  <option value="">Seleccionar curso</option>
                  {formData.school && courses
                    .filter(course => 
                      typeof course.school === 'string' 
                        ? course.school === formData.school
                        : course.school && (course.school as School)._id === formData.school
                    )
                    .map(course => (
                      <option key={course._id} value={course._id}>
                        {course.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton} disabled={loading}>
                  {loading ? 'Procesando...' : 'Guardar'}
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

      {/* Modal Vincular Usuario */}
      {showLinkModal && selectedUserToLink && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Vincular Asistente a Cuenta Nueva</h2>
            <p className={styles.modalDescription}>
              Va a crear una cuenta para <strong>{selectedUserToLink.name}</strong>, 
              lo que permitirá que este asistente tenga acceso a la plataforma.
            </p>
            
            <form onSubmit={completeUserLinking} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="linkEmail">Email*</label>
                <input
                  type="email"
                  id="linkEmail"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="linkPassword">Contraseña temporal*</label>
                <input
                  type="password"
                  id="linkPassword"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                />
                <small>El usuario deberá cambiarla en su primer inicio de sesión</small>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton} disabled={loading}>
                  {loading ? 'Procesando...' : 'Crear Cuenta'}
                </button>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={() => {
                    setSelectedUserToLink(null);
                    setShowLinkModal(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {showEditUserModal && selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Editar Usuario</h2>
            
            <form onSubmit={handleSaveUserChanges} className={styles.form}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Nombre completo*</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">Email*</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="password">Nueva contraseña (opcional)</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder="Dejar en blanco para mantener la actual"
                />
                <small>Solo complete este campo si desea cambiar la contraseña</small>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="role">Rol*</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                  className={styles.select}
                  disabled={user?.role !== 'super_admin' && formData.role === 'super_admin'}
                >
                  <option value="student">Estudiante</option>
                  <option value="teacher">Profesor</option>
                  {user?.role === 'super_admin' && (
                    <>
                      <option value="admin">Administrador</option>
                      <option value="school_owner">Propietario de Escuela</option>
                      <option value="super_admin">Super Administrador</option>
                    </>
                  )}
                  {user?.role === 'admin' && (
                    <option value="admin">Administrador</option>
                  )}
                </select>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton} disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
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

      {/* Modal Enrollar Usuario a Curso */}
      {showEnrollModal && selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Enrollar a Curso</h2>
            <p className={styles.modalDescription}>
              Seleccione una escuela y curso para enrollar a <strong>{selectedUser.name}</strong>
            </p>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                Cargando datos...
              </div>
            ) : userSchools.length === 0 ? (
              <div className={styles.error} style={{ marginBottom: '1rem' }}>
                No hay escuelas disponibles. Por favor, cree primero una escuela.
              </div>
            ) : courses.length === 0 ? (
              <div className={styles.error} style={{ marginBottom: '1rem' }}>
                No hay cursos disponibles. Por favor, cree primero un curso.
              </div>
            ) : (
              <form onSubmit={handleEnrollUserToCourse} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="enrollSchool">Escuela*</label>
                  <select
                    id="enrollSchool"
                    name="school"
                    value={formData.school}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev, 
                        school: e.target.value,
                        course: '' // Resetear curso al cambiar escuela
                      }));
                    }}
                    required
                    className={styles.select}
                  >
                    <option value="">Seleccionar escuela</option>
                    {userSchools.map(school => (
                      <option key={school._id} value={school._id}>
                        {school.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="enrollCourse">Curso*</label>
                  <select
                    id="enrollCourse"
                    name="course"
                    value={formData.course}
                    onChange={handleInputChange}
                    required
                    className={styles.select}
                    disabled={!formData.school}
                  >
                    <option value="">Seleccionar curso</option>
                    {formData.school && courses
                      .filter(course => 
                        typeof course.school === 'string' 
                          ? course.school === formData.school
                          : course.school && (course.school as School)._id === formData.school
                      )
                      .map(course => (
                        <option key={course._id} value={course._id}>
                          {course.title}
                        </option>
                      ))}
                  </select>
                  
                  {formData.school && getFilteredCourses().length === 0 && (
                    <small style={{ color: '#e53e3e', marginTop: '0.5rem', display: 'block' }}>
                      No hay cursos disponibles para esta escuela. Por favor seleccione otra o cree un curso.
                    </small>
                  )}
                </div>

                <div className={styles.formActions}>
                  <button 
                    type="submit" 
                    className={styles.submitButton} 
                    disabled={loading || !formData.school || !formData.course}
                    style={{ 
                      display: 'inline-block',
                      visibility: 'visible',
                      opacity: 1,
                      backgroundColor: (loading || !formData.school || !formData.course) ? '#90cdf4' : '#3182ce'
                    }}
                  >
                    {loading ? 'Procesando...' : 'Enrollar Usuario'}
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
            )}
          </div>
        </div>
      )}

      {/* Modal de Error */}
      {showErrorModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle} style={{ color: '#e53e3e' }}>Error</h2>
            <p className={styles.modalDescription} style={{ color: '#2d3748' }}>
              {errorMessage}
            </p>
            <div className={styles.formActions} style={{ justifyContent: 'center' }}>
              <button 
                type="button" 
                className={styles.submitButton}
                style={{ backgroundColor: '#3182ce' }}
                onClick={() => {
                  setShowErrorModal(false);
                  setErrorMessage('');
                }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver cursos del usuario */}
      {showUserCoursesModal && selectedUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Cursos de {selectedUser.name}</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                Cargando cursos...
              </div>
            ) : userCourses.length === 0 ? (
              <p className={styles.modalDescription}>
                Este usuario no está inscrito en ningún curso.
              </p>
            ) : (
              <>
                <p className={styles.modalDescription}>
                  Total de cursos: <strong>{userCourses.length}</strong>
                </p>
                <div className={styles.courseList}>
                  {userCourses.map((course) => (
                    <div key={course._id} className={styles.courseItem}>
                      <div className={styles.courseTitle}>
                        <FaGraduationCap style={{ marginRight: '0.5rem' }} />
                        {course.title || `Curso ID: ${course._id}`}
                      </div>
                      <div className={styles.courseDetails}>
                        <span>
                          <FaCalendarAlt style={{ marginRight: '0.3rem' }} />
                          {course.createdAt ? `Inscrito desde: ${new Date(course.createdAt).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'})}` : 'Fecha de inscripción desconocida'}
                        </span>
                        <span>
                          <FaUniversity style={{ marginRight: '0.3rem' }} />
                          {typeof course.school === 'string' 
                            ? schools.find(s => s._id === course.school)?.name || 'Escuela no disponible' 
                            : course.school?.name || 'Escuela no disponible'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <div className={styles.formActions}>
              <button 
                type="button" 
                className={styles.cancelButton}
                onClick={() => {
                  setShowUserCoursesModal(false);
                  setUserCourses([]);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para registrar pagos */}
      {showPaymentModal && selectedUser && (
        <PaymentRegistrationModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSave={handleRegisterPayment}
          userId={selectedUser._id}
          userName={selectedUser.name}
          userCourses={userCourses}
        />
      )}

      {/* Modal para asignar rol en escuela */}
      <AssignSchoolRoleModal
        isOpen={showAssignRoleModal}
        onClose={() => setShowAssignRoleModal(false)}
        user={selectedUserForRole}
        onSuccess={handleRoleAssigned}
      />
    </div>
  );
} 