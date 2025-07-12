import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../styles/SchoolOwnerManagement.module.css';
import { FaTrash, FaUser, FaSearch } from 'react-icons/fa';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface SchoolOwnerManagementProps {
  schoolId: string;
  currentUserId: string;
  onUpdate?: () => void;
  onOwnersChange?: (owners: User[]) => void;
}

const SchoolOwnerManagement: React.FC<SchoolOwnerManagementProps> = ({
  schoolId,
  currentUserId,
  onUpdate,
  onOwnersChange
}) => {
  const [originalOwners, setOriginalOwners] = useState<User[]>([]);
  const [currentOwners, setCurrentOwners] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchSchoolOwners();
  }, [schoolId]);

  const fetchSchoolOwners = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Get school details first to find the main admin
      const schoolResponse = await axios.get(`${apiUrl}/api/schools/${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const school = schoolResponse.data;
      const owners: User[] = [];
      
      // Add the main school admin if exists
      if (school.admin) {
        owners.push({
          _id: school.admin._id || school.admin,
          name: school.admin.name || 'Admin',
          email: school.admin.email || '',
          role: 'school_owner'
        });
      }
      
      // Get all teachers/users associated with the school to find additional owners
      try {
        const teachersResponse = await axios.get(`${apiUrl}/api/schools/${schoolId}/teachers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const teachers = teachersResponse.data;
        teachers.forEach((teacher: any) => {
          // Check if this user is a school owner and not already added
          const isSchoolOwner = teacher.schoolRoles?.some((role: any) => 
            role.schoolId === schoolId && role.role === 'school_owner'
          ) || teacher.ownedSchools?.includes(schoolId);
          
          const alreadyAdded = owners.some(owner => owner._id === teacher._id);
          
          if (isSchoolOwner && !alreadyAdded) {
            owners.push({
              _id: teacher._id,
              name: teacher.name,
              email: teacher.email,
              role: teacher.role
            });
          }
        });
      } catch (teachersError) {
        console.warn('Could not fetch teachers:', teachersError);
      }
      
      setOriginalOwners(owners);
      setCurrentOwners([...owners]);
    } catch (error) {
      console.error('Error fetching school owners:', error);
      setError('Error al cargar los dueños de la escuela');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (term: string) => {
    if (term.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await axios.get(
        `${apiUrl}/api/users/search-by-email?email=${encodeURIComponent(term)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Filter out users who are already school owners
      const filteredResults = response.data.filter((user: User) => 
        !currentOwners.some((owner: User) => owner._id === user._id)
      );
      
      setSearchResults(filteredResults);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching users:', error);
      setError('Error al buscar usuarios');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    searchUsers(term);
  };

  const addSchoolOwner = (user: User) => {
    setError('');
    
    // Check if user is already in the list
    if (currentOwners.some(owner => owner._id === user._id)) {
      setError('Este usuario ya es dueño de la escuela');
      return;
    }

    const newOwners = [...currentOwners, user];
    setCurrentOwners(newOwners);
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    
    // Notify parent of changes
    if (onOwnersChange) {
      onOwnersChange(newOwners);
    }
  };

  const removeSchoolOwner = (userId: string) => {
    // Don't allow removing the current user
    if (userId === currentUserId) {
      setError('No puedes removerte a ti mismo como dueño de escuela');
      return;
    }

    setError('');
    const newOwners = currentOwners.filter(owner => owner._id !== userId);
    setCurrentOwners(newOwners);
    
    // Notify parent of changes
    if (onOwnersChange) {
      onOwnersChange(newOwners);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando dueños de escuela...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3><FaUser /> Dueños de Escuela</h3>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Add Owner Search */}
      <div className={styles.addOwnerSection}>
        <label htmlFor="owner-search">Agregar Dueño de Escuela:</label>
        <div className={styles.searchInputContainer}>
          <div className={styles.searchInput}>
            <FaSearch />
            <input
              id="owner-search"
              type="text"
              placeholder="Buscar usuario por email..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          
          {searching && <div className={styles.searchLoading}>Buscando...</div>}
          
          {showResults && searchResults.length > 0 && (
            <div className={styles.searchResults}>
              {searchResults.map((user) => (
                <div key={user._id} className={styles.searchResult}>
                  <div className={styles.userInfo}>
                    <h4>{user.name}</h4>
                    <p>{user.email}</p>
                    <span className={styles.roleBadge}>{user.role}</span>
                  </div>
                  <button
                    className={styles.addUserButton}
                    onClick={() => addSchoolOwner(user)}
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {searchTerm.length >= 3 && !searching && searchResults.length === 0 && showResults && (
            <div className={styles.noResults}>
              No se encontraron usuarios con ese email
            </div>
          )}
        </div>
      </div>

      {/* Current Owners List */}
      <div className={styles.ownersList}>
        {currentOwners.length === 0 ? (
          <p className={styles.noOwners}>No hay dueños de escuela registrados</p>
        ) : (
          currentOwners.map((owner: User) => (
            <div key={owner._id} className={styles.ownerCard}>
              <div className={styles.ownerInfo}>
                <h4>{owner.name}</h4>
                <p>{owner.email}</p>
                <span className={styles.roleBadge}>{owner.role}</span>
              </div>
              <div className={styles.ownerActions}>
                {owner._id !== currentUserId && (
                  <button
                    className={styles.removeButton}
                    onClick={() => removeSchoolOwner(owner._id)}
                    title="Remover dueño de escuela"
                  >
                    <FaTrash />
                  </button>
                )}
                {owner._id === currentUserId && (
                  <span className={styles.currentUserBadge}>Tú</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SchoolOwnerManagement; 