import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/Admin.module.css';
import Link from 'next/link';
import { FaEdit, FaTrash, FaUserPlus, FaLink, FaUserCheck } from 'react-icons/fa';
import { useApiErrorHandler } from '../../utils/api-error-handler';

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
  schoolRoles?: any[];
  enrolledCourses?: string[];
  isRegistered?: boolean; // Para diferenciar usuarios registrados vs no registrados
  createdAt?: Date;
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
  const [user, setUser] = useState<DecodedToken | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserType, setCreateUserType] = useState<UserType>(UserType.REGISTERED);
  const [schools, setSchools] = useState<School[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserToLink, setSelectedUserToLink] = useState<any>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student',
    password: '',
    school: '',
    course: '',
  });

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

      fetchData();
    } catch (error) {
      console.error('Error al decodificar token:', error);
      Cookies.remove('token');
      router.push('/login');
    }
  }, [router]);

  // Obtener datos iniciales
  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
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

      setUsers(usersResponse.data.map((user: User) => ({...user, isRegistered: true})));
      setSchools(schoolsResponse.data);
      setCourses(coursesResponse.data);
      setAttendanceRecords(attendanceResponse.data);
      
      // Procesar los registros de asistencia para extraer usuarios no registrados
      processAttendanceForUnregisteredUsers(attendanceResponse.data);
      
      // Configurar usuarios filtrados iniciales
      setFilteredUsers(usersResponse.data);
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
    
    attendanceRecords.forEach(record => {
      // Solo procesar si el estudiante es un string (no registrado) en vez de un objeto
      if (typeof record.student === 'string') {
        if (!nonRegisteredAttendees.has(record.student)) {
          nonRegisteredAttendees.set(record.student, {
            name: record.student,
            isRegistered: false,
            occurrences: 1,
            courses: record.course ? [record.course] : [],
            lastSeen: new Date(record.date)
          });
        } else {
          const existingRecord = nonRegisteredAttendees.get(record.student);
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
    
    setUnregisteredUsers(Array.from(nonRegisteredAttendees.values()));
  };

  // Filtrar usuarios por término de búsqueda
  useEffect(() => {
    if (searchTerm === '') {
      setFilteredUsers(users);
      return;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = users.filter(user => 
      user.name.toLowerCase().includes(lowerSearchTerm) ||
      user.email.toLowerCase().includes(lowerSearchTerm) ||
      user.role.toLowerCase().includes(lowerSearchTerm)
    );
    
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

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
            schoolId: formData.school,
            courseId: formData.course,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Actualizar la lista de usuarios
        setUsers(prev => [...prev, {...response.data, isRegistered: true}]);
        
      } else {
        // Para usuarios no registrados, simplemente agregamos a nuestra lista local
        // Estos usuarios solo existirán en las listas de asistencia
        const newUnregisteredUser = {
          name: formData.name,
          isRegistered: false,
          occurrences: 0,
          courses: formData.course ? [formData.course] : [],
          lastSeen: new Date()
        };
        
        setUnregisteredUsers(prev => [...prev, newUnregisteredUser]);
      }
      
      // Limpiar formulario y cerrar modal
      setFormData({
        name: '',
        email: '',
        role: 'student',
        password: '',
        school: '',
        course: '',
      });
      setShowCreateUserModal(false);
      
    } catch (error) {
      console.error('Error al crear usuario:', error);
      setError(handleApiError(error));
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

  if (loading && users.length === 0) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Gestión de Usuarios</h1>
          <div className={styles.controls}>
            <div className={styles.search}>
              <input
                type="text"
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
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

        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tabButton} ${selectedSchool === '' ? styles.active : ''}`}
              onClick={() => setSelectedSchool('')}
            >
              Todos los Usuarios
            </button>
            <button 
              className={`${styles.tabButton} ${selectedSchool === 'unregistered' ? styles.active : ''}`}
              onClick={() => setSelectedSchool('unregistered')}
            >
              Asistentes Sin Registro
            </button>
            {schools.map(school => (
              <button 
                key={school._id}
                className={`${styles.tabButton} ${selectedSchool === school._id ? styles.active : ''}`}
                onClick={() => setSelectedSchool(school._id)}
              >
                {school.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.tableContainer}>
          {selectedSchool === 'unregistered' ? (
            // Tabla de usuarios no registrados
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Asistencias</th>
                  <th>Cursos</th>
                  <th>Última Asistencia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {unregisteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyMessage}>
                      No hay asistentes sin registro en el sistema.
                    </td>
                  </tr>
                ) : (
                  unregisteredUsers.map((user, index) => (
                    <tr key={index}>
                      <td>{user.name}</td>
                      <td>{user.occurrences}</td>
                      <td>{user.courses.length}</td>
                      <td>{new Date(user.lastSeen).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className={styles.iconButton}
                          onClick={() => handleLinkUser(user)}
                          title="Vincular a cuenta registrada"
                        >
                          <FaLink />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            // Tabla de usuarios registrados (con filtro por escuela si es necesario)
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
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.emptyMessage}>
                      No se encontraron usuarios.
                    </td>
                  </tr>
                ) : (
                  filteredUsers
                    .filter(user => selectedSchool === '' || 
                      (user.schoolRoles && user.schoolRoles.some(sr => sr.schoolId === selectedSchool)))
                    .map(user => (
                      <tr key={user._id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                            {user.role}
                          </span>
                        </td>
                        <td>{user.enrolledCourses?.length || 0}</td>
                        <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button 
                              className={styles.iconButton}
                              title="Editar usuario"
                            >
                              <FaEdit />
                            </button>
                            <button 
                              className={`${styles.iconButton} ${styles.deleteButton}`}
                              title="Eliminar usuario"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
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
                      <option value="admin">Administrador</option>
                      {user?.role === 'super_admin' && (
                        <>
                          <option value="school_owner">Propietario de Escuela</option>
                          <option value="super_admin">Super Administrador</option>
                        </>
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
                  onChange={handleInputChange}
                  className={styles.select}
                >
                  <option value="">Seleccionar escuela</option>
                  {schools.map(school => (
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
                  {courses
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
    </div>
  );
} 