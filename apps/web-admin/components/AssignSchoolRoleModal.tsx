import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../styles/Modal.module.css';
import { FaTimes, FaSchool, FaUserTag } from 'react-icons/fa';

interface School {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface AssignSchoolRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  schools?: School[];
  onRoleAssigned?: () => void;
  onSuccess?: () => void;
}

const AssignSchoolRoleModal: React.FC<AssignSchoolRoleModalProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  schools: propSchools,
  onRoleAssigned,
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedRole, setSelectedRole] = useState('teacher');
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  useEffect(() => {
    if (isOpen && user) {
      if (propSchools && propSchools.length > 0) {
        setSchools(propSchools);
        if (propSchools.length > 0) {
          setSelectedSchool(propSchools[0]._id);
        }
      } else {
        fetchSchools();
      }
      getCurrentUserRole();
    }
  }, [isOpen, user, propSchools]);

  const getCurrentUserRole = async () => {
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Obtener información del usuario actual
      const response = await axios.get(
        `${apiUrl}/api/auth/profile`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Current user profile response:', response.data);
      
      if (response.data && response.data.role) {
        const role = String(response.data.role).toLowerCase();
        console.log('Setting current user role:', role);
        setCurrentUserRole(role);
      }
    } catch (error) {
      console.error('Error al obtener información del usuario:', error);
    }
  };

  const fetchSchools = async () => {
    setLoadingSchools(true);
    setError('');
    
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await axios.get(
        `${apiUrl}/api/schools`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSchools(response.data);
      if (response.data.length > 0) {
        setSelectedSchool(response.data[0]._id);
      }
    } catch (error) {
      console.error('Error al cargar escuelas:', error);
      setError('No se pudieron cargar las escuelas');
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSchool) {
      setError('Debes seleccionar una escuela');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Datos a enviar
      const postData = {
        schoolId: selectedSchool,
        role: selectedRole
      };
      
      // Imprimir los datos para depuración
      console.log('Enviando datos para asignar rol:', postData);
      
      // Usar el nuevo endpoint simplificado
      const response = await axios.post(
        `${apiUrl}/api/users/${user?._id}/assign-role-in-school`,
        postData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Respuesta del servidor:', response.data);
      setSuccess('Rol asignado correctamente');
      
      // Notificar al componente padre para que actualice la lista
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onRoleAssigned) onRoleAssigned();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error al asignar rol:', error);
      
      // Mostrar datos detallados del error para ayudar en depuración
      if (error.response) {
        console.error('Respuesta de error del servidor:', error.response.data);
        console.error('Estado HTTP:', error.response.status);
        console.error('Cabeceras:', error.response.headers);
      } else if (error.request) {
        console.error('No se recibió respuesta:', error.request);
      } else {
        console.error('Error al configurar la petición:', error.message);
      }
      
      // Mostrar mensaje de error más descriptivo
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.response?.status === 400) {
        setError('Error en los datos: Verifica que la escuela y el rol sean válidos');
      } else if (error.response?.status === 403) {
        setError('No tienes permisos para asignar este rol en esta escuela');
      } else {
        setError(error.message || 'Error al asignar rol');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async () => {
    if (!selectedSchool || !selectedRole || !user?._id) {
      setError('Debes seleccionar escuela y rol');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      await axios.delete(`${apiUrl}/api/users/${user._id}/school-role`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { schoolId: selectedSchool, role: selectedRole },
      });

      setSuccess('Rol removido correctamente');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        if (onRoleAssigned) onRoleAssigned();
        onClose();
      }, 1200);
    } catch (error: any) {
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.response?.status === 403) {
        setError('No tienes permisos para remover este rol');
      } else {
        setError(error.message || 'Error al remover rol');
      }
    } finally {
      setLoading(false);
    }
  };

  // Determinar qué roles mostrar según el rol del usuario actual
  const getRoleOptions = () => {
    // Log the current role to debug
    console.log('getRoleOptions called with role:', currentUserRole);
    
    // Por defecto, mostrar solo roles básicos
    const defaultRoles = (
      <>
        <option value="teacher">Profesor</option>
        <option value="administrative">Administrativo</option>
        <option value="student">Estudiante</option>
      </>
    );

    // Super admin puede asignar cualquier rol - normalized to lowercase for comparison
    if (currentUserRole && currentUserRole.toLowerCase() === 'super_admin') {
      console.log('Showing all roles for super_admin');
      return (
        <>
          <option value="super_admin">Super Administrador</option>
          <option value="admin">Administrador</option>
          <option value="school_owner">Dueño de Escuela</option>
          <option value="teacher">Profesor</option>
          <option value="administrative">Administrativo</option>
          <option value="student">Estudiante</option>
          <option value="unregistered">No Registrado</option>
        </>
      );
    }
    
    // Admin y school_owner pueden asignar roles por debajo de ellos
    if (currentUserRole && (currentUserRole.toLowerCase() === 'admin' || currentUserRole.toLowerCase() === 'school_owner')) {
      return defaultRoles;
    }
    
    // Teacher solo puede manejar estudiantes
    if (currentUserRole && currentUserRole.toLowerCase() === 'teacher') {
      return <option value="student">Estudiante</option>;
    }
    
    return defaultRoles;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <header className={styles.modalHeader}>
          <h2>Asignar Rol en Escuela</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <FaTimes />
          </button>
        </header>
        
        <div className={styles.modalBody}>
          {user && (
            <div className={styles.userInfo}>
              <p><strong>Usuario:</strong> {user.name}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Rol global:</strong> {user.role}</p>
            </div>
          )}
          
          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="school">
                <FaSchool /> Escuela:
              </label>
              {loadingSchools ? (
                <p>Cargando escuelas...</p>
              ) : schools.length === 0 ? (
                <p>No hay escuelas disponibles</p>
              ) : (
                <select
                  id="school"
                  value={selectedSchool}
                  onChange={(e) => setSelectedSchool(e.target.value)}
                  required
                  className={styles.select}
                  disabled={loading}
                >
                  <option value="">Seleccionar escuela</option>
                  {schools.map(school => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="role">
                <FaUserTag /> Rol en esta escuela:
              </label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                required
                className={styles.select}
                disabled={loading}
              >
                {getRoleOptions()}
              </select>
            </div>
            
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleRemoveRole}
                disabled={loading || !selectedSchool}
              >
                {loading ? 'Procesando...' : 'Quitar Rol'}
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading || !selectedSchool}
              >
                {loading ? 'Asignando...' : 'Asignar Rol'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AssignSchoolRoleModal; 
