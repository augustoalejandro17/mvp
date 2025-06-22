import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/CourseForm.module.css';
import ImageUploader from '../../components/ImageUploader';
import ImagePreviewHelper from '../../components/ImagePreviewHelper';
import CourseScheduleManager from '../../components/CourseScheduleManager';
import { FaTimes } from 'react-icons/fa';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

interface School {
  _id: string;
  name: string;
  description: string;
  admin: string;
}

interface SchoolWithPermission extends School {
  canEdit: boolean;
}

interface Teacher {
  _id: string;
  name: string;
  email: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Category {
  _id: string;
  name: string;
  description: string;
}

interface ScheduleTime {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export default function CreateCourse() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [schools, setSchools] = useState<SchoolWithPermission[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [additionalTeachers, setAdditionalTeachers] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0, scale: 1 });
  
  // Schedule state
  const [scheduleTimes, setScheduleTimes] = useState<ScheduleTime[]>([]);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [notificationMinutes, setNotificationMinutes] = useState(10);

  useEffect(() => {
    // Verificar autenticación
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      
      // Roles que pueden crear cursos en cualquier escuela
      const globalAdminRoles = ['super_admin', 'admin'];
      // Roles que pueden crear cursos solo en escuelas donde tienen permisos
      const schoolSpecificRoles = ['school_owner', 'administrative', 'teacher'];
      
      // Si es admin global, puede continuar sin problemas
      if (globalAdminRoles.includes(decoded.role)) {
        setUserId(decoded.sub);
        fetchSchools(token, decoded.sub, decoded.role);
      } 
      // Si tiene un rol específico de escuela, puede continuar pero las escuelas se filtrarán en fetchSchools
      else if (schoolSpecificRoles.includes(decoded.role)) {
        setUserId(decoded.sub);
      fetchSchools(token, decoded.sub, decoded.role);
      } 
      // Si no tiene ningún rol permitido
      else {
        console.log('Usuario sin permisos suficientes:', decoded.role);
        setError('No tienes permisos para crear cursos. Necesitas ser administrador, profesor o dueño de una escuela.');
        setLoadingSchools(false);
        // Comentamos la redirección para permitir pruebas
        // router.push('/');
        // return;
      }
      
    } catch (error) {
      console.error('Error decodificando token:', error);
      router.push('/login');
    }
  }, [router]);

  // Actualizar useEffect para el schoolId para cargar profesores
  useEffect(() => {
    if (router.isReady && schools.length > 0) {
      // Verificar si hay un schoolId en la URL
      const { schoolId: querySchoolId } = router.query;
      
      let newSchoolId = '';
      
      if (querySchoolId && typeof querySchoolId === 'string') {
        // Verificar que la escuela exista en nuestras escuelas disponibles
        const schoolExists = schools.some(school => school._id === querySchoolId);
        
        if (schoolExists) {
          newSchoolId = querySchoolId;
        } else {
          // Si la escuela no existe, usar la primera disponible
          newSchoolId = schools[0]._id;
        }
      } else if (schools.length > 0) {
        // Si no hay escuela en la URL, usar la primera disponible
        newSchoolId = schools[0]._id;
      }
      
      if (newSchoolId) {
        setSchoolId(newSchoolId);
        // Cargar profesores para esta escuela
        fetchTeachersBySchool(newSchoolId);
      }
    }
  }, [router.isReady, router.query, schools]);
  
  // Agregar un useEffect para cuando cambie manualmente el schoolId
  useEffect(() => {
    if (schoolId) {
      fetchTeachersBySchool(schoolId);
      // Resetear profesores adicionales al cambiar de escuela
      setAdditionalTeachers([]);
    }
  }, [schoolId]);

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Método para manejar la selección de profesores adicionales
  const handleAdditionalTeacherChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    
    if (!selectedValue) return;
    
    // Verificar si ya está seleccionado como profesor principal
    if (selectedValue === selectedTeacherId) {
      setError("Este profesor ya es el profesor principal del curso");
      return;
    }
    
    // Verificar si ya está en la lista de profesores adicionales
    if (additionalTeachers.includes(selectedValue)) {
      setError("Este profesor ya ha sido seleccionado");
      return;
    }
    
    // Verificar límite de 5 profesores en total (1 principal + 4 adicionales)
    if (additionalTeachers.length >= 4) {
      setError("No se pueden añadir más de 4 profesores adicionales (5 en total)");
      return;
    }
    
    // Añadir el profesor a la lista
    setAdditionalTeachers([...additionalTeachers, selectedValue]);
    setError(''); // Limpiar cualquier error previo
  };
  
  // Método para eliminar un profesor adicional
  const removeAdditionalTeacher = (teacherId: string) => {
    setAdditionalTeachers(additionalTeachers.filter(id => id !== teacherId));
  };

  const fetchSchools = async (token: string, userId: string, role: string) => {
    try {
      setLoadingSchools(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Para super_admin y admin, todas las escuelas son editables
      const isSuperOrAdmin = ['super_admin', 'admin'].includes(role);
      
      let allSchools = [];
      
      try {
        // Obtenemos todas las escuelas disponibles en un solo endpoint
        const endpoint = `${apiUrl}/api/schools`;
        const response = await axios.get(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Si es super_admin o admin, todas las escuelas son editables
        allSchools = response.data.map((school: any) => ({
          ...school,
          canEdit: isSuperOrAdmin // true para super_admin y admin, false para otros roles
        }));
        
        // Para otros roles, filtramos basado en permisos
        if (!isSuperOrAdmin) {
          // Obtener escuelas donde el usuario tiene permisos específicos
          let userSchoolsEndpoint;
          if (role === 'school_owner') {
            userSchoolsEndpoint = `${apiUrl}/api/schools/owner/${userId}`;
          } else if (role === 'administrative' || role === 'teacher') {
            userSchoolsEndpoint = `${apiUrl}/api/schools/teacher/${userId}`;
          }
          
          if (userSchoolsEndpoint) {
            const userResponse = await axios.get(userSchoolsEndpoint, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            // Marcar las escuelas donde el usuario tiene permisos
            const userSchoolIds = userResponse.data.map((s: any) => s._id);
            
            allSchools = allSchools.map((school: any) => ({
              ...school,
              canEdit: isSuperOrAdmin || userSchoolIds.includes(school._id)
            }));
          }
        }
        
        console.log(`Total escuelas cargadas: ${allSchools.length}, usuario con rol: ${role}`);
        
        if (allSchools.length === 0) {
          setError('No se encontraron escuelas disponibles en el sistema.');
        } else {
          // Ordenamos las escuelas: primero las que el usuario puede editar
          allSchools.sort((a: any, b: any) => {
            if (a.canEdit && !b.canEdit) return -1;
            if (!a.canEdit && b.canEdit) return 1;
            return a.name.localeCompare(b.name); // Ordenamos alfabéticamente como criterio secundario
          });
          
          setSchools(allSchools);
        }
      } catch (error) {
        console.error('Error al cargar escuelas:', error);
        // Si es super_admin y hay un error, mostramos un mensaje específico
        if (isSuperOrAdmin) {
          setError('Error al cargar escuelas. Como administrador, deberías poder ver todas las escuelas. Verifica la configuración del backend.');
        } else {
          setError('No se pudieron cargar las escuelas disponibles');
        }
      }
    } catch (error) {
      console.error('Error general en fetchSchools:', error);
      setError('Error al cargar las escuelas. Por favor, inténtalo de nuevo más tarde.');
    } finally {
      setLoadingSchools(false);
    }
  };

  const fetchTeachersBySchool = async (schoolId: string) => {
    try {
      setLoadingTeachers(true);
      const token = Cookies.get('token');
      if (!token) {
        console.error('No hay token disponible');
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(
        `${apiUrl}/api/users/teachers-by-school/${schoolId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      setTeachers(response.data);
      
      // Si hay profesores y el usuario actual es un profesor y está en la lista, 
      // seleccionarlo automáticamente
      const decoded = jwtDecode<DecodedToken>(token);
      if (response.data.length > 0) {
        const currentUserIsTeacher = response.data.some(
          (teacher: Teacher) => teacher._id === decoded.sub
        );
        
        if (currentUserIsTeacher) {
          setSelectedTeacherId(decoded.sub);
        } else if (decoded.role === 'super_admin' || decoded.role === 'admin') {
          // Si es admin, seleccionar el primer profesor por defecto
          setSelectedTeacherId(response.data[0]._id);
        }
      }
    } catch (error) {
      console.error('Error al cargar profesores:', error);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await axios.get(`${apiUrl}/api/categories?hierarchical=true`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleImageUpload = (imageUrl: string) => {
    setImageUrl(imageUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar si es super_admin o admin
    const token = Cookies.get('token');
    let isSuperOrAdmin = false;
    
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        isSuperOrAdmin = ['super_admin', 'admin'].includes(decoded.role);
      } catch (error) {
        console.error('Error al decodificar token:', error);
      }
    }
    
    // Validación básica
    if (!name || !description || !schoolId) {
      setError('Todos los campos marcados con * son obligatorios');
      return;
    }
    
    // Verificar si tenemos permisos para la escuela seleccionada
    const selectedSchool = schools.find(school => school._id === schoolId);
    if (!selectedSchool) {
      setError('La escuela seleccionada no existe');
      return;
    }
    
    // Super_admin y admin siempre pueden crear cursos en cualquier escuela
    if (!isSuperOrAdmin && selectedSchool.canEdit === false) {
      setError('No tienes permisos para crear cursos en la escuela seleccionada');
      return;
    }
    
    // Validar que se haya seleccionado un profesor principal
    if (!selectedTeacherId) {
      setError('Debes seleccionar un profesor principal para el curso');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = Cookies.get('token');
      
      if (!token) {
        setError('No hay token de autenticación disponible');
        setLoading(false);
        return;
      }
      
      // Añadir información de usuario para debugging
      let userInfo = '';
      try {
        const decoded = jwtDecode<any>(token);
        
        userInfo = `Usuario: ${decoded.email} (${decoded.role}), ID: ${decoded.sub}`;
      } catch (e) {
        console.error('Error al decodificar token para logs:', e);
        userInfo = 'Error al decodificar token';
      }
      
      // Clean schedule data before submission
      const cleanedScheduleTimes = scheduleTimes.map(time => ({
        dayOfWeek: time.dayOfWeek,
        startTime: time.startTime,
        endTime: time.endTime,
        isActive: time.isActive
      }));

      // Datos para enviar
      const courseData = {
        title: name, 
        description, 
        coverImageUrl: imageUrl || null, 
        isPublic,
        schoolId,
        teacher: selectedTeacherId,
        teachers: additionalTeachers.length > 0 ? [...additionalTeachers] : undefined,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        // Schedule data
        scheduleTimes: cleanedScheduleTimes,
        enableNotifications,
        notificationMinutes
      };
      
      // Mostrar información de depuración
      const debugData = `
        URL API: ${apiUrl}/api/courses
        Método: POST
        
        ${userInfo}
        
        Datos enviados:
        ${JSON.stringify(courseData, null, 2)}
      `;
      
      setDebugInfo(debugData);
      
      const response = await axios.post(
        `${apiUrl}/api/courses`, 
        courseData,
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          } 
        }
      );
      
      setSuccess(true);
      setDebugInfo(debugInfo + `\n\nRespuesta: ${JSON.stringify(response.data, null, 2)}`);
      
      // Redirigir a la página de la escuela después de 2 segundos
      setTimeout(() => {
        router.push(`/school/${schoolId}`);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error al crear curso:', error);
      
      if (error.response) {
        console.error('Detalles de la respuesta de error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: JSON.stringify(error.response.data)
        });
        
        setDebugInfo(debugInfo + `\n\nError: ${error.response.status} ${error.response.statusText}
          Detalles: ${JSON.stringify(error.response.data, null, 2)}
        `);
        
        if (error.response.data && error.response.data.message) {
          // Para mensajes simples
          if (typeof error.response.data.message === 'string') {
            setError(error.response.data.message);
          } 
          // Para arrays de mensajes (validación)
          else if (Array.isArray(error.response.data.message)) {
            setError(error.response.data.message.join(', '));
          }
        } else if (error.response.status === 401) {
          setError('No tienes autorización para crear cursos en esta escuela');
        } else {
          setError(`Error ${error.response.status}: ${error.response.statusText || 'Error desconocido'}`);
        }
      } else if (error.request) {
        console.error('Error de red - no se recibió respuesta:', error.request);
        setError('Error de red: no se pudo conectar con el servidor. Verifica tu conexión.');
        setDebugInfo(debugInfo + `\n\nError de red: No se recibió respuesta del servidor.`);
      } else {
        console.error('Error de configuración de solicitud:', error.message);
        setError('Error al crear el curso. Por favor, intenta de nuevo más tarde.');
        setDebugInfo(debugInfo + `\n\nError: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingSchools) {
    return <div className={styles.loadingContainer}>Cargando escuelas disponibles...</div>;
  }

  if (schools.length === 0) {
    // Verificar si es super_admin o admin para mostrar un mensaje diferente
    const token = Cookies.get('token');
    let isAdmin = false;
    
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        isAdmin = ['super_admin', 'admin'].includes(decoded.role);
      } catch (error) {
        console.error('Error al decodificar token:', error);
      }
    }
    
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>Crear Nuevo Curso</h1>
          <div className={styles.error}>
            {isAdmin ? (
              <>
                <p>No hay escuelas disponibles en el sistema. Como administrador, primero debes crear una escuela para poder crear cursos.</p>
                <button 
                  onClick={() => router.push('/school/create')} 
                  className={styles.button}
                  style={{ marginTop: '20px' }}
                >
                  Crear una Escuela
                </button>
              </>
            ) : (
              <>
                <p>No tienes escuelas asignadas. Para crear un curso, primero debes tener acceso a una escuela.</p>
          <button 
            onClick={() => router.push('/school/create')} 
            className={styles.button}
            style={{ marginTop: '20px' }}
          >
            Crear una Escuela
          </button>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Crear Nuevo Curso</h1>
        
        {success ? (
          <div className={styles.success}>
            <p>¡Curso creado con éxito! Redirigiendo...</p>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {error && (
              <div className={styles.error}>
                <p>{error}</p>
                {error.includes('autorización') && (
                  <p className={styles.inputHelp}>
                    Esto puede ocurrir si no eres profesor o administrador de la escuela seleccionada.
                    Asegúrate de que estás intentando crear un curso en una escuela donde tienes permisos.
                  </p>
                )}
              </div>
            )}
            
            {/* Mostrar un mensaje para super_admin */}
            {(() => {
              const token = Cookies.get('token');
              let isSuperAdmin = false;
              
              if (token) {
                try {
                  const decoded = jwtDecode<DecodedToken>(token);
                  isSuperAdmin = decoded.role === 'super_admin';
                } catch (error) {
                  console.error('Error al decodificar token:', error);
                }
              }
              
              return isSuperAdmin && (
                <div className={styles.adminInfo} style={{
                  background: '#e3f2fd',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '20px'
                }}>
                  <p style={{ margin: 0 }}>
                    <strong>Modo Super Admin:</strong> Puedes crear cursos en cualquier escuela.
                  </p>
                </div>
              );
            })()}
            
            <div className={styles.formGroup}>
              <label htmlFor="schoolId">Escuela*</label>
              <select
                id="schoolId"
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                required
                className={styles.select}
              >
                {schools.map((school) => (
                  <option 
                    key={school._id} 
                    value={school._id}
                    disabled={school.canEdit === false}
                  >
                    {school.name} {school.canEdit === false ? '(sin permisos de edición)' : ''}
                  </option>
                ))}
              </select>
              <p className={styles.inputHelp}>
                Selecciona la escuela donde quieres crear el curso. Solo puedes crear cursos en escuelas donde tienes permisos.
              </p>
            </div>

            {/* Selección de Categorías */}
            <div className={styles.formGroup}>
              <label htmlFor="categories">Categorías (máximo 5)</label>
              {loadingCategories ? (
                <p className={styles.loadingText}>Cargando categorías...</p>
              ) : (
                <>
                  <div className={styles.categoriesContainer}>
                    {categories.map((category) => (
                      <div key={category._id} className={styles.categoryGroup}>
                        <div className={styles.categorySection}>
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  if (selectedCategories.length < 5) {
                                    setSelectedCategories([...selectedCategories, category._id]);
                                  }
                                } else {
                                  setSelectedCategories(selectedCategories.filter(id => id !== category._id));
                                }
                              }}
                              disabled={!selectedCategories.includes(category._id) && selectedCategories.length >= 5}
                            />
                            <strong>{category.name}</strong>
                          </label>
                        </div>
                        {category.children && category.children.length > 0 && (
                          <div className={styles.subcategoriesContainer}>
                            {category.children.map((subcategory: any) => (
                              <label key={subcategory._id} className={styles.checkboxLabel} style={{ marginLeft: '20px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedCategories.includes(subcategory._id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      if (selectedCategories.length < 5) {
                                        setSelectedCategories([...selectedCategories, subcategory._id]);
                                      }
                                    } else {
                                      setSelectedCategories(selectedCategories.filter(id => id !== subcategory._id));
                                    }
                                  }}
                                  disabled={!selectedCategories.includes(subcategory._id) && selectedCategories.length >= 5}
                                />
                                {subcategory.name}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {selectedCategories.length > 0 && (
                    <div className={styles.selectedCategoriesPreview}>
                      <p><strong>Categorías seleccionadas ({selectedCategories.length}/5):</strong></p>
                      <div className={styles.selectedCategoriesList}>
                        {selectedCategories.map(categoryId => {
                          const category = categories.find(c => c._id === categoryId) || 
                                         categories.flatMap(c => c.children || []).find((sub: any) => sub._id === categoryId);
                          return (
                            <span key={categoryId} className={styles.categoryTag}>
                              {category?.name || categoryId}
                              <button 
                                type="button" 
                                onClick={() => setSelectedCategories(selectedCategories.filter(id => id !== categoryId))}
                                className={styles.removeCategory}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <p className={styles.inputHelp}>
                    Selecciona hasta 5 categorías para clasificar tu curso (opcional)
                  </p>
                </>
              )}
            </div>
            
            {/* Selección de Profesor Principal */}
            <div className={styles.formGroup}>
              <label htmlFor="teacherId">Profesor Principal*</label>
              {loadingTeachers ? (
                <p className={styles.loadingText}>Cargando profesores...</p>
              ) : teachers.length === 0 ? (
                <div>
                  <p className={styles.error}>No hay profesores disponibles para esta escuela</p>
                  <p className={styles.inputHelp}>
                    Debes asignar profesores a esta escuela antes de crear un curso. 
                    Puedes hacerlo desde la página de edición de la escuela.
                  </p>
                </div>
              ) : (
                <>
                  <select
                    id="teacherId"
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    required
                    className={styles.select}
                  >
                    <option value="">Seleccionar un profesor principal</option>
                    {teachers.map((teacher) => (
                      <option key={teacher._id} value={teacher._id}>
                        {teacher.name} ({teacher.email})
                      </option>
                    ))}
                  </select>
                  <p className={styles.inputHelp}>
                    El profesor principal responsable del curso
                  </p>
                </>
              )}
            </div>
            
            {/* Selección de Profesores Adicionales */}
            {teachers.length > 0 && (
              <div className={styles.formGroup}>
                <label htmlFor="additionalTeachers">Profesores Adicionales (máximo 4)</label>
                <div style={{ marginBottom: '10px' }}>
                  <select
                    id="additionalTeachers"
                    onChange={handleAdditionalTeacherChange}
                    className={styles.select}
                    value=""
                    disabled={additionalTeachers.length >= 4 || teachers.length <= 1}
                  >
                    <option value="">Seleccionar profesores adicionales</option>
                    {teachers
                      .filter(teacher => teacher._id !== selectedTeacherId && !additionalTeachers.includes(teacher._id))
                      .map((teacher) => (
                        <option key={teacher._id} value={teacher._id}>
                          {teacher.name} ({teacher.email})
                        </option>
                      ))}
                  </select>
                </div>
                
                {/* Lista de profesores adicionales seleccionados */}
                {additionalTeachers.length > 0 && (
                  <div className={styles.selectedTeachersList}>
                    <p><strong>Profesores adicionales seleccionados:</strong></p>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {additionalTeachers.map(teacherId => {
                        const teacher = teachers.find(t => t._id === teacherId);
                        return (
                          <li key={teacherId} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '8px',
                            margin: '5px 0',
                            backgroundColor: '#f8f8f8',
                            borderRadius: '4px'
                          }}>
                            <span>{teacher ? `${teacher.name} (${teacher.email})` : teacherId}</span>
                            <button 
                              type="button"
                              onClick={() => removeAdditionalTeacher(teacherId)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#dc3545',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                fontSize: '0.9rem'
                              }}
                            >
                              <FaTimes />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                
                <p className={styles.inputHelp}>
                  Puedes añadir hasta 4 profesores adicionales (5 en total contando el profesor principal)
                </p>
              </div>
            )}
            
            <div className={styles.formGroup}>
              <label htmlFor="name">Nombre del Curso*</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ej: Salsa Cubana Nivel 1"
                className={styles.input}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="description">Descripción*</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                placeholder="Describe el curso, objetivos, prerrequisitos, etc."
                className={styles.textarea}
              ></textarea>
            </div>
            
            <div className={styles.formGroup}>
              <label>Imagen del Curso</label>
              <ImageUploader 
                onImageUpload={handleImageUpload} 
                label="Imagen de portada" 
                className={styles.imageUploader}
              />
              <p className={styles.inputHelp}>Sube una imagen para tu curso (opcional)</p>
              
              {/* Show preview if there's an image */}
              {imageUrl && (
                <ImagePreviewHelper
                  imageUrl={imageUrl}
                  title="Vista previa del curso"
                />
              )}
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>Curso Público</span>
              </label>
              <p className={styles.inputHelp}>Los cursos públicos aparecerán en la lista de cursos disponibles</p>
            </div>

            {/* Schedule Section */}
            <div className={styles.formGroup}>
              <label>Horarios del Curso</label>
              <CourseScheduleManager
                scheduleTimes={scheduleTimes}
                enableNotifications={enableNotifications}
                notificationMinutes={notificationMinutes}
                onScheduleTimesChange={setScheduleTimes}
                onEnableNotificationsChange={setEnableNotifications}
                onNotificationMinutesChange={setNotificationMinutes}
              />
              <p className={styles.inputHelp}>
                Define los días y horarios de las clases (opcional). Si configuras horarios, se enviarán notificaciones automáticas a los profesores.
              </p>
            </div>
            
            <button type="submit" className={styles.button} disabled={loading || teachers.length === 0}>
              {loading ? 'Creando...' : 'Crear Curso'}
            </button>
            
            {debugInfo && (
              <div className={styles.debugInfo}>
                <details>
                  <summary>Información de depuración</summary>
                  <pre>{debugInfo}</pre>
                </details>
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
} 