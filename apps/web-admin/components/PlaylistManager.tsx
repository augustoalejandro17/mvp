import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { FaPlus, FaEdit, FaTrash, FaList, FaPlay, FaGripVertical, FaTrashAlt, FaMinus, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import styles from '../styles/PlaylistManager.module.css';

interface Playlist {
  _id: string;
  name: string;
  description?: string;
  classes: Class[];
  isDefault: boolean;
  isPublic: boolean;
  order: number;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
}

interface Class {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  videoStatus?: 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR';
  videoProcessingError?: string;
  thumbnailUrl?: string;
  duration?: number;
  order: number;
  isPublic: boolean;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
}

interface PlaylistManagerProps {
  courseId: string;
  onClassSelect: (classItem: Class) => void;
  selectedClass: Class | null;
  canModify: boolean;
  onClassView?: (classItem: Class) => void;
  onClassEdit?: (classId: string) => void;
  onClassDelete?: (classId: string) => void;
  refreshTrigger?: number; // Add refresh trigger prop
  onPlaylistsLoaded?: (playlists: Playlist[]) => void; // Add callback for when playlists are loaded
}

interface DragState {
  classId: string;
  fromIndex: number;
  playlistId: string;
  startY: number;
  currentY: number;
  isDragging: boolean;
  element?: HTMLElement;
}

export default function PlaylistManager({ courseId, onClassSelect, selectedClass, canModify, onClassView, onClassEdit, onClassDelete, refreshTrigger, onPlaylistsLoaded }: PlaylistManagerProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [unorganizedClasses, setUnorganizedClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [newPlaylistIsPublic, setNewPlaylistIsPublic] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<{ classId: string; fromIndex: number; playlistId: string } | null>(null);
  const [touchDragState, setTouchDragState] = useState<DragState | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const dragGhostRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPlaylists = useCallback(async (retryCount = 0, preserveExpandedState = false) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      // Prepare headers - include authorization if token exists
      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.get(`${apiUrl}/api/playlists?courseId=${courseId}`, {
        headers
      });
      setPlaylists(response.data);
      
      // Call the callback with the loaded playlists
      if (onPlaylistsLoaded) {
        onPlaylistsLoaded(response.data);
      }
      
      // Only reset expanded state on initial load, not on refresh
      if (!preserveExpandedState) {
        // Start with all playlists collapsed
        setExpandedPlaylists(new Set());
        if (response.data.length > 0) {
          const defaultPlaylist = response.data.find((p: Playlist) => p.isDefault) || response.data[0];
          setSelectedPlaylist(defaultPlaylist._id);
        }
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
      
      // Retry logic for intermittent failures (max 2 retries)
      if (retryCount < 2) {
        console.log(`Retrying fetchPlaylists (attempt ${retryCount + 1}/2)...`);
        setTimeout(() => fetchPlaylists(retryCount + 1, preserveExpandedState), 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        console.error('Failed to fetch playlists after 2 retries');
      }
    }
  }, [courseId]);

  const fetchUnorganizedClasses = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      
      // Prepare headers - include authorization if token exists
      const headers: any = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.get(`${apiUrl}/api/playlists/unorganized?courseId=${courseId}`, {
        headers
      });
      setUnorganizedClasses(response.data);
    } catch (error) {
      console.error('Error fetching unorganized classes:', error);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchPlaylists();
    fetchUnorganizedClasses();
  }, [fetchPlaylists, fetchUnorganizedClasses]);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      fetchPlaylists();
      fetchUnorganizedClasses();
    }
  }, [refreshTrigger, fetchPlaylists, fetchUnorganizedClasses]);

  // Auto-refresh to check for video processing updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Check if there are any processing videos
      const hasProcessingVideos = [...playlists, ...unorganizedClasses]
        .flatMap(item => 'classes' in item ? item.classes : [item])
        .some(classItem => 
          classItem.videoStatus === 'UPLOADING' || 
          classItem.videoStatus === 'PROCESSING'
        );
      
      if (hasProcessingVideos) {
        fetchPlaylists(0, true);
        fetchUnorganizedClasses();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [playlists, unorganizedClasses, fetchPlaylists, fetchUnorganizedClasses]);

  // Clean up touch drag state when component unmounts
  useEffect(() => {
    return () => {
      if (touchDragState?.element) {
        touchDragState.element.style.transform = '';
        touchDragState.element.style.zIndex = '';
        touchDragState.element.style.pointerEvents = '';
      }
    };
  }, [touchDragState?.element]);

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      await axios.post(`${apiUrl}/api/playlists`, {
        name: newPlaylistName,
        description: newPlaylistDescription,
        course: courseId,
        isPublic: newPlaylistIsPublic,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNewPlaylistName('');
      setNewPlaylistDescription('');
      setNewPlaylistIsPublic(true);
      setShowCreateForm(false);
      fetchPlaylists(0, true); // Preserve expanded state when creating playlist
    } catch (error) {
      console.error('Error creating playlist:', error);
    }
  };

  const updatePlaylist = async () => {
    if (!editingPlaylist || !newPlaylistName.trim()) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      await axios.patch(`${apiUrl}/api/playlists/${editingPlaylist._id}`, {
        name: newPlaylistName,
        description: newPlaylistDescription,
        isPublic: newPlaylistIsPublic,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEditingPlaylist(null);
      setNewPlaylistName('');
      setNewPlaylistDescription('');
      setNewPlaylistIsPublic(true);
      fetchPlaylists(0, true); // Preserve expanded state when updating playlist
    } catch (error) {
      console.error('Error updating playlist:', error);
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta lista de reproducción?')) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      await axios.delete(`${apiUrl}/api/playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchPlaylists(0, true); // Preserve expanded state when deleting playlist
      fetchUnorganizedClasses();
    } catch (error) {
      console.error('Error deleting playlist:', error);
    }
  };

  const addClassToPlaylist = async (playlistId: string, classId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      console.log('Adding class to playlist:', { playlistId, classId });
      await axios.post(`${apiUrl}/api/playlists/${playlistId}/add-class`, {
        classId: classId,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchPlaylists(0, true); // Preserve expanded state when adding class
      fetchUnorganizedClasses();
    } catch (error) {
      console.error('Error adding class to playlist:', error);
      if (axios.isAxiosError(error) && error.response) {
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
        // Show user-friendly error message
        alert(`Error al añadir clase a la lista: ${error.response?.data?.message || error.message}`);
      } else {
        alert('Error al añadir clase a la lista');
      }
    }
  };

  const reorderClassesInPlaylist = async (playlistId: string, classIds: string[]) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      await axios.post(`${apiUrl}/api/playlists/${playlistId}/reorder`, {
        classIds: classIds,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Preserve expanded state when refreshing after reorder
      fetchPlaylists(0, true);
    } catch (error) {
      console.error('Error reordering classes in playlist:', error);
    }
  };

  const removeClassFromPlaylist = async (playlistId: string, classId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');
      await axios.post(`${apiUrl}/api/playlists/${playlistId}/remove-class`, {
        classId: classId,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      fetchPlaylists(0, true); // Preserve expanded state when removing class
      fetchUnorganizedClasses();
    } catch (error) {
      console.error('Error removing class from playlist:', error);
    }
  };

  const togglePlaylist = (playlistId: string) => {
    const newExpanded = new Set(expandedPlaylists);
    if (newExpanded.has(playlistId)) {
      newExpanded.delete(playlistId);
    } else {
      newExpanded.add(playlistId);
    }
    setExpandedPlaylists(newExpanded);
  };

  const startEditing = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setNewPlaylistName(playlist.name);
    setNewPlaylistDescription(playlist.description || '');
    setNewPlaylistIsPublic(playlist.isPublic);
  };

  const cancelEditing = () => {
    setEditingPlaylist(null);
    setNewPlaylistName('');
    setNewPlaylistDescription('');
    setNewPlaylistIsPublic(true);
    setShowCreateForm(false);
  };

  // Desktop Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, classItem: Class, index: number, playlistId: string) => {
    e.stopPropagation(); // Prevent bubbling to playlist header
    setDraggedItem({ classId: classItem._id, fromIndex: index, playlistId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to playlist header
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number, targetPlaylistId: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to playlist header
    setDragOverIndex(null);
    
    if (!draggedItem || draggedItem.playlistId !== targetPlaylistId) {
      setDraggedItem(null);
      return;
    }

    const playlist = playlists.find(p => p._id === targetPlaylistId);
    if (!playlist) return;

    if (draggedItem.fromIndex === targetIndex) {
      setDraggedItem(null);
      return;
    }

    // Create new order for the classes
    const newClasses = [...playlist.classes];
    const [movedClass] = newClasses.splice(draggedItem.fromIndex, 1);
    newClasses.splice(targetIndex, 0, movedClass);

    // Update the playlist order
    reorderClassesInPlaylist(targetPlaylistId, newClasses.map(c => c._id));
    setDraggedItem(null);
  };

  // Check if the event target is the drag handle or its child
  const isDragHandle = (element: Element | null): boolean => {
    if (!element) return false;
    
    // Check if the element itself has the drag handle class
    if (element.classList.contains(styles.dragHandle)) return true;
    
    // Check if any parent element has the drag handle class (for SVG icons)
    let parent = element.parentElement;
    while (parent && !parent.classList.contains(styles.classItem)) {
      if (parent.classList.contains(styles.dragHandle)) return true;
      parent = parent.parentElement;
    }
    
    return false;
  };

  // Mobile Touch handlers
  const handleTouchStart = (e: React.TouchEvent, classItem: Class, index: number, playlistId: string) => {
    // Only start drag if touch started on the drag handle
    if (!isDragHandle(e.target as Element)) {
      return;
    }
    
    e.stopPropagation();
    
    const touch = e.touches[0];
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    
    setTouchDragState({
      classId: classItem._id,
      fromIndex: index,
      playlistId,
      startY: touch.clientY,
      currentY: touch.clientY,
      isDragging: false,
      element
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragState) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const deltaY = touch.clientY - touchDragState.startY;
    
    // Start dragging if moved more than 10px
    if (!touchDragState.isDragging && Math.abs(deltaY) > 10) {
      setTouchDragState(prev => prev ? { ...prev, isDragging: true } : null);
      
      // Add visual feedback
      if (touchDragState.element) {
        touchDragState.element.style.transform = `translateY(${deltaY}px)`;
        touchDragState.element.style.zIndex = '1000';
        touchDragState.element.style.opacity = '0.8';
        touchDragState.element.classList.add(styles.dragging);
      }
    }
    
    if (touchDragState.isDragging && touchDragState.element) {
      touchDragState.element.style.transform = `translateY(${deltaY}px)`;
      
      // Calculate which item we're over
      const playlist = playlists.find(p => p._id === touchDragState.playlistId);
      if (playlist) {
        const itemHeight = 60; // Approximate height of a class item
        const newIndex = Math.max(0, Math.min(
          playlist.classes.length - 1,
          touchDragState.fromIndex + Math.round(deltaY / itemHeight)
        ));
        setDragOverIndex(newIndex);
      }
    }
    
    setTouchDragState(prev => prev ? { ...prev, currentY: touch.clientY } : null);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchDragState) return;
    
    e.stopPropagation();
    
    // Reset visual state
    if (touchDragState.element) {
      touchDragState.element.style.transform = '';
      touchDragState.element.style.zIndex = '';
      touchDragState.element.style.opacity = '';
      touchDragState.element.classList.remove(styles.dragging);
    }
    
    if (touchDragState.isDragging && dragOverIndex !== null && dragOverIndex !== touchDragState.fromIndex) {
      const playlist = playlists.find(p => p._id === touchDragState.playlistId);
      if (playlist) {
        // Create new order for the classes
        const newClasses = [...playlist.classes];
        const [movedClass] = newClasses.splice(touchDragState.fromIndex, 1);
        newClasses.splice(dragOverIndex, 0, movedClass);

        // Update the playlist order
        reorderClassesInPlaylist(touchDragState.playlistId, newClasses.map(c => c._id));
      }
    }
    
    setTouchDragState(null);
    setDragOverIndex(null);
  };

  if (loading) {
    return <div className={styles.loading}>Cargando listas de reproducción...</div>;
  }

  const token = Cookies.get('token');
  const isAuthenticated = !!token;

  return (
    <div className={styles.playlistManager} ref={containerRef}>
      <div className={styles.header}>
        <h3><FaList /> Listas de Reproducción</h3>
        {canModify && (
          <button 
            className={styles.addButton}
            onClick={() => setShowCreateForm(true)}
          >
            <FaPlus /> Nueva Lista
          </button>
        )}
      </div>

      {/* Create/Edit Form - Only show for authenticated users who can modify */}
      {canModify && (showCreateForm || editingPlaylist) && (
        <div className={styles.form}>
          <input
            type="text"
            placeholder="Nombre de la lista"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className={styles.input}
          />
          <textarea
            placeholder="Descripción (opcional)"
            value={newPlaylistDescription}
            onChange={(e) => setNewPlaylistDescription(e.target.value)}
            className={styles.textarea}
          />
          <div className={styles.visibilityControl}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={newPlaylistIsPublic}
                onChange={(e) => setNewPlaylistIsPublic(e.target.checked)}
                className={styles.checkbox}
              />
              <span>Pública (visible para todos los usuarios)</span>
            </label>
          </div>
          <div className={styles.formActions}>
            <button 
              onClick={editingPlaylist ? updatePlaylist : createPlaylist}
              className={styles.saveButton}
            >
              {editingPlaylist ? 'Actualizar' : 'Crear'}
            </button>
            <button 
              onClick={cancelEditing}
              className={styles.cancelButton}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Playlists */}
      <div className={styles.playlistList}>
        {playlists.map((playlist, index) => (
          <div key={playlist._id} className={styles.playlistItem}>
            <div 
              className={`${styles.playlistHeader} ${
                index % 2 === 0 ? styles.playlistHeaderEven : styles.playlistHeaderOdd
              } ${expandedPlaylists.has(playlist._id) ? styles.playlistHeaderExpanded : ''}`}
              onClick={() => togglePlaylist(playlist._id)}
            >
              <div className={styles.playlistInfo}>
                {expandedPlaylists.has(playlist._id) ? 
                  <FaChevronDown className={styles.expandIcon} /> : 
                  <FaChevronRight className={styles.expandIcon} />
                }
                <FaGripVertical className={styles.dragHandle} />
                <div className={styles.playlistNameContainer}>
                  <span className={styles.playlistName}>{playlist.name}</span>
                  <div className={styles.playlistBadges}>
                    {playlist.isDefault && <span className={styles.defaultBadge}>Por defecto</span>}
                    {!playlist.isPublic && <span className={styles.privateBadge}>Privada</span>}
                  </div>
                </div>
                <span className={styles.classCount}>({playlist.classes.length})</span>
              </div>
              {canModify && !playlist.isDefault && (
                <div className={styles.playlistActions}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(playlist);
                    }}
                    className={styles.editButton}
                  >
                    <FaEdit />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePlaylist(playlist._id);
                    }}
                    className={styles.deleteButton}
                  >
                    <FaTrash />
                  </button>
                </div>
              )}
            </div>

            {expandedPlaylists.has(playlist._id) && (
              <div className={styles.classList}>
                {playlist.classes.length === 0 ? (
                  <div className={styles.emptyPlaylist}>
                    Esta lista está vacía. {canModify && 'Arrastra clases aquí para organizarlas.'}
                  </div>
                ) : (
                  playlist.classes.map((classItem, index) => (
                    <div 
                      key={classItem._id}
                      className={`${styles.classItem} ${
                        selectedClass?._id === classItem._id ? styles.activeClass : ''
                      } ${
                        dragOverIndex === index ? styles.dragOver : ''
                      } ${
                        touchDragState?.isDragging && touchDragState.fromIndex === index ? styles.dragging : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent bubbling to playlist header
                        if (!touchDragState?.isDragging) {
                        onClassSelect(classItem);
                        }
                      }}
                      // Drop zone for desktop drag and drop
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index, playlist._id)}
                      // Mobile touch events - only for detecting drag handle touch
                      onTouchStart={(e) => canModify && !playlist.isDefault && playlist.classes.length > 1 && handleTouchStart(e, classItem, index, playlist._id)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    >
                      {canModify && !playlist.isDefault && playlist.classes.length > 1 && (
                        <div 
                          className={styles.dragHandle}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, classItem, index, playlist._id)}
                        >
                          <FaGripVertical />
                        </div>
                      )}
                      {classItem.videoStatus === 'UPLOADING' ? (
                        <span className={`${styles.playIcon} ${styles.statusIcon}`} style={{color: '#ffc107'}}>⬆️</span>
                      ) : classItem.videoStatus === 'PROCESSING' ? (
                        <span className={`${styles.playIcon} ${styles.statusIcon}`} style={{color: '#ffc107'}}>⚙️</span>
                      ) : classItem.videoStatus === 'ERROR' ? (
                        <span className={`${styles.playIcon} ${styles.statusIcon}`} style={{color: '#e53e3e'}}>❌</span>
                      ) : (
                        <FaPlay className={styles.playIcon} />
                      )}
                      <div className={styles.classInfo}>
                        <span className={styles.classTitle}>
                          {classItem.title}
                          {classItem.videoStatus === 'UPLOADING' && (
                            <span className={styles.statusBadge} style={{backgroundColor: '#ffc107'}}>Subiendo</span>
                          )}
                          {classItem.videoStatus === 'PROCESSING' && (
                            <span className={styles.statusBadge} style={{backgroundColor: '#ffc107'}}>Procesando</span>
                          )}
                          {classItem.videoStatus === 'ERROR' && (
                            <span className={styles.statusBadge} style={{backgroundColor: '#e53e3e'}}>Error</span>
                          )}
                        </span>
                        {classItem.duration && (
                          <span className={styles.duration}>
                            {Math.floor(classItem.duration / 60)}:{(classItem.duration % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      
                      {/* Class Action Buttons */}
                      <div className={styles.classActionButtons}>
                        {canModify && onClassEdit && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onClassEdit(classItem._id);
                            }}
                            className={styles.classActionBtn}
                            title="Editar clase"
                          >
                            <FaEdit />
                          </button>
                        )}
                        {canModify && onClassDelete && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onClassDelete(classItem._id);
                            }}
                            className={styles.classActionBtn}
                            title="Eliminar clase"
                          >
                            <FaTrashAlt />
                          </button>
                        )}
                        {canModify && !playlist.isDefault && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeClassFromPlaylist(playlist._id, classItem._id);
                            }}
                            className={styles.removeFromPlaylistButton}
                            title="Quitar de la lista"
                          >
                            <FaMinus />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        {/* Unorganized Classes - Only visible to users who can modify */}
        {canModify && unorganizedClasses.length > 0 && (
          <div className={styles.playlistItem}>
            <div 
              className={styles.playlistHeader}
              onClick={() => togglePlaylist('unorganized')}
            >
              <div className={styles.playlistInfo}>
                <span className={styles.playlistName}>Sin organizar</span>
                <span className={styles.classCount}>({unorganizedClasses.length})</span>
              </div>
            </div>

            {expandedPlaylists.has('unorganized') && (
              <div className={styles.classList}>
                {unorganizedClasses.map((classItem) => (
                  <div 
                    key={classItem._id}
                    className={`${styles.classItem} ${selectedClass?._id === classItem._id ? styles.activeClass : ''}`}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent bubbling to playlist header
                      onClassSelect(classItem);
                    }}
                  >
                    {classItem.videoStatus === 'UPLOADING' ? (
                      <span className={`${styles.playIcon} ${styles.statusIcon}`} style={{color: '#ffc107'}}>⬆️</span>
                    ) : classItem.videoStatus === 'PROCESSING' ? (
                      <span className={`${styles.playIcon} ${styles.statusIcon}`} style={{color: '#ffc107'}}>⚙️</span>
                    ) : classItem.videoStatus === 'ERROR' ? (
                      <span className={`${styles.playIcon} ${styles.statusIcon}`} style={{color: '#e53e3e'}}>❌</span>
                    ) : (
                      <FaPlay className={styles.playIcon} />
                    )}
                    <div className={styles.classInfo}>
                      <span className={styles.classTitle}>
                        {classItem.title}
                        {classItem.videoStatus === 'UPLOADING' && (
                          <span className={styles.statusBadge} style={{backgroundColor: '#ffc107'}}>Subiendo</span>
                        )}
                        {classItem.videoStatus === 'PROCESSING' && (
                          <span className={styles.statusBadge} style={{backgroundColor: '#ffc107'}}>Procesando</span>
                        )}
                        {classItem.videoStatus === 'ERROR' && (
                          <span className={styles.statusBadge} style={{backgroundColor: '#e53e3e'}}>Error</span>
                        )}
                      </span>
                      {classItem.duration && (
                        <span className={styles.duration}>
                          {Math.floor(classItem.duration / 60)}:{(classItem.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    
                    {/* Class Action Buttons */}
                    <div className={styles.classActionButtons}>
                      {canModify && onClassEdit && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onClassEdit(classItem._id);
                          }}
                          className={styles.classActionBtn}
                          title="Editar clase"
                        >
                          <FaEdit />
                        </button>
                      )}
                      {canModify && onClassDelete && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onClassDelete(classItem._id);
                          }}
                          className={styles.classActionBtn}
                          title="Eliminar clase"
                        >
                          <FaTrashAlt />
                        </button>
                      )}
                      
                      {/* Playlist Selection - Only for modify users */}
                      {canModify && playlists.length > 0 && (
                        <select
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (e.target.value) {
                              addClassToPlaylist(e.target.value, classItem._id);
                              e.target.value = '';
                            }
                          }}
                          className={styles.playlistSelect}
                        >
                          <option value="">Añadir a lista...</option>
                          {playlists.filter(p => !p.isDefault).map(playlist => (
                            <option key={playlist._id} value={playlist._id}>
                              {playlist.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 