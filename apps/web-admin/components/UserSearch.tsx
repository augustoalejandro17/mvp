import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../styles/UserSearch.module.css';
import { FaSearch, FaUserPlus, FaUserCog, FaTimes, FaGlobeAmericas } from 'react-icons/fa';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  schoolRoles?: { schoolId: string; role: string }[];
}

interface School {
  _id: string;
  name: string;
}

interface UserSearchProps {
  onSelectUser: (user: User) => void;
  onAssignRole: (user: User) => void;
  availableSchools: School[];
  selectedSchool?: string;
}

const UserSearch: React.FC<UserSearchProps> = ({ 
  onSelectUser, 
  onAssignRole, 
  availableSchools,
  selectedSchool 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
    if (searchTerm.length < 3) {
      setError('Ingresa al menos 3 caracteres para buscar');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Construir URL - siempre hacemos búsqueda global sin filtrar por escuela
      const url = `${apiUrl}/api/users/search-by-email?email=${encodeURIComponent(searchTerm)}`;
      
      const response = await axios.get(
        url,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setUsers(response.data);
      setShowResults(true);
    } catch (error: any) {
      console.error('Error al buscar usuarios:', error);
      setError(error.response?.data?.message || 'Error al buscar usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    // Ocultar resultados cuando cambia la escuela seleccionada
    setShowResults(false);
    setUsers([]);
  }, [selectedSchool]);

  // Manejar la búsqueda cuando el usuario ingresa más de 3 caracteres
  useEffect(() => {
    if (searchTerm.length >= 3) {
      const delayDebounceFn = setTimeout(() => {
        handleSearch();
      }, 500);
      
      return () => clearTimeout(delayDebounceFn);
    } else {
      setUsers([]);
      if (searchTerm.length === 0) {
        setShowResults(false);
      }
    }
  }, [searchTerm, handleSearch]);

  // Detectar clics fuera del componente para cerrar los resultados
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    // Detectar la tecla ESC para cerrar el modal
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  const handleSelectUser = (user: User) => {
    onSelectUser(user);
    setShowResults(false);
    setSearchTerm('');
  };

  const handleAssignRole = (user: User) => {
    onAssignRole(user);
    setShowResults(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const closeResults = () => {
    setShowResults(false);
  };

  const focusSearch = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={styles.userSearch} ref={searchRef}>
      <div className={styles.searchContainer}>
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar usuario por email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.searchInput}
            onClick={focusSearch}
          />
          <button 
            className={styles.searchButton}
            onClick={handleSearch}
            disabled={loading || searchTerm.length < 3}
          >
            <FaSearch /> Buscar
          </button>
        </div>
        
        {error && <div className={styles.error}>{error}</div>}
        
        {loading && <div className={styles.loading}>Buscando usuarios...</div>}
        
        {showResults && (
          <div className={styles.resultsContainer}>
            <div className={styles.resultsHeader}>
              <h3>Resultados ({users.length})</h3>
              <div className={styles.resultsMeta}>
                <span className={styles.globalBadge} title="Búsqueda global en todo el sistema">
                  <FaGlobeAmericas /> Global
                </span>
                <button className={styles.closeButton} onClick={closeResults} title="Cerrar resultados">
                  <FaTimes />
                </button>
              </div>
            </div>
            
            {users.length === 0 ? (
              <div className={styles.noResults}>
                No se encontraron usuarios con ese email
              </div>
            ) : (
              <div className={styles.results}>
                <ul className={styles.userList}>
                  {users.map((user) => (
                    <li key={user._id} className={styles.userItem}>
                      <div className={styles.userInfo}>
                        <div className={styles.userName}>{user.name}</div>
                        <div className={styles.userEmail}>{user.email}</div>
                        <div className={styles.userRole}>
                          <span className={styles.roleBadge}>{user.role}</span>
                          {selectedSchool && user.schoolRoles?.some(
                            sr => sr.schoolId === selectedSchool
                          ) && (
                            <span className={styles.schoolRoleBadge}>
                              {user.schoolRoles.find(sr => sr.schoolId === selectedSchool)?.role}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.userActions}>
                        <button
                          className={styles.assignButton}
                          onClick={() => handleAssignRole(user)}
                          title="Asignar rol en escuela"
                        >
                          <FaUserCog />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      <div className={styles.searchInfo}>
        Búsqueda global: encuentra usuarios de todo el sistema para asignarles roles
      </div>
    </div>
  );
};

export default UserSearch; 