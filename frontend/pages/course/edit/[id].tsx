import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../../styles/CourseForm.module.css';
import { useApiErrorHandler } from '../../../utils/api-error-handler';
import ImageUploader from '../../../components/ImageUploader';
import ImagePreviewHelper from '../../../components/ImagePreviewHelper';
import CourseScheduleManager from '../../../components/CourseScheduleManager';
import { FaTimes } from 'react-icons/fa';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface School {
  _id: string;
  name: string;
}

interface Teacher {
  _id: string;
  name: string;
  email: string;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  school: School | string;
  isPublic: boolean;
  teacher: Teacher | string;
  teachers?: (Teacher | string)[];
  category?: any;
}

interface ScheduleTime {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export default function EditCourse() {
  const router = useRouter();
  const { id } = router.query;
  
  const [course, setCourse] = useState<Course | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [additionalTeachers, setAdditionalTeachers] = useState<string[]>([]);
  
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0, scale: 1 });
  
  // Schedule state
  const [scheduleTimes, setScheduleTimes] = useState<ScheduleTime[]>([]);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [notificationMinutes, setNotificationMinutes] = useState(10);
  
  const { handleApiError } = useApiErrorHandler();

  const fetchCourse = useCallback(async (courseId: string, token: string) => {
    setLoading(true);
    setError('');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await axios.get(
        `${apiUrl}/api/courses/${courseId}?includeSchedule=true`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const courseData = response.data;
      setCourse(courseData);
      
      // Fill form fields
      setTitle(courseData.title || '');
      setDescription(courseData.description || '');
      setCoverImageUrl(courseData.coverImageUrl || '');
      
      // Set school ID
      if (typeof courseData.school === 'object' && courseData.school._id) {
        setSchoolId(courseData.school._id);
      } else if (typeof courseData.school === 'string') {
        setSchoolId(courseData.school);
      }
      
      // Set teacher ID
      if (typeof courseData.teacher === 'object' && courseData.teacher._id) {
        setTeacherId(courseData.teacher._id);
      } else if (typeof courseData.teacher === 'string') {
        setTeacherId(courseData.teacher);
      }
      
      // Set additional teachers
      if (courseData.teachers && Array.isArray(courseData.teachers)) {
        const teachersArray = courseData.teachers.map((teacher: any) => {
          if (typeof teacher === 'object' && teacher._id) {
            return teacher._id;
          }
          return String(teacher);
        });
        
        // Filtrar para eliminar el profesor principal de la lista de adicionales
        const filteredTeachers = teachersArray.filter((id: string) => {
          const teacherIdStr = typeof teacherId === 'object' ? (teacherId as any)._id : teacherId;
          return id !== teacherIdStr;
        });
        
        setAdditionalTeachers(filteredTeachers);
      }
      
      setIsPublic(courseData.isPublic || false);
      
      // Set categories
      if (courseData.categories && Array.isArray(courseData.categories)) {
        const categoryIds = courseData.categories.map((cat: any) => 
          typeof cat === 'object' && cat._id ? cat._id : String(cat)
        );
        setSelectedCategories(categoryIds);
      } else if (courseData.category) {
        // Handle legacy single category
        const categoryId = typeof courseData.category === 'object' && courseData.category._id 
          ? courseData.category._id 
          : String(courseData.category);
        setSelectedCategories([categoryId]);
      }

      // Set schedule data
      if (courseData.schedule) {
        // Clean schedule times when loading from API and convert to lowercase
        const cleanScheduleTimes = (courseData.schedule.scheduleTimes || []).map((time: any) => ({
          dayOfWeek: time.dayOfWeek.toLowerCase(), // Convert to lowercase to match backend enum
          startTime: time.startTime,
          endTime: time.endTime,
          isActive: time.isActive
        }));
        
        setScheduleTimes(cleanScheduleTimes);
        setEnableNotifications(courseData.schedule.enableNotifications ?? true);
        setNotificationMinutes(courseData.schedule.notificationMinutes || 10);
      }
      
    } catch (error) {
      console.error('Error fetching course:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  }, [handleApiError, teacherId]);

  const fetchTeachersBySchool = useCallback(async (schoolId: string) => {
    if (!schoolId) return;
    
    setLoadingTeachers(true);
    setError('');
    
    try {
      const token = Cookies.get('token');
      if (!token) {
        throw new Error('No active session');
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await axios.get(
        `${apiUrl}/api/schools/${schoolId}/teachers`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setTeachers(response.data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      setError(handleApiError(error));
    } finally {
      setLoadingTeachers(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const userRole = String(decoded.role).toLowerCase();
      
      const hasPermission = ['super_admin', 'admin', 'school_owner', 'administrative', 'teacher'].includes(userRole);
      
      if (!hasPermission) {
        router.push('/');
        return;
      }
    } catch (error) {
      router.push('/login');
      return;
    }

    // Make sure id is a valid string
    if (id && typeof id === 'string') {
      fetchCourse(id, token);
      fetchSchools(token);
      fetchCategories();
    }
  }, [id, router, fetchCourse]);

  // Cargar profesores cuando cambia la escuela
  useEffect(() => {
    if (schoolId) {
      fetchTeachersBySchool(schoolId);
    }
  }, [schoolId, fetchTeachersBySchool]);

  const fetchSchools = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await axios.get(
        `${apiUrl}/api/schools`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSchools(response.data);
    } catch (error) {
      console.error('Error fetching schools:', error);
      // Don't block the UI for this error, just show a message
      setError(prev => prev || 'Could not load schools. Some options may not be available.');
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
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
    setCoverImageUrl(imageUrl);
  };

  // Método para manejar la selección de profesores adicionales
  const handleAdditionalTeacherChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    
    if (!selectedValue) return;
    
    // Verificar si ya está seleccionado como profesor principal
    if (selectedValue === teacherId) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!title.trim() || !description.trim() || !schoolId || !teacherId) {
      setError('Título, descripción, escuela y profesor principal son obligatorios');
      return;
    }
    
    setSaving(true);
    setError('');
    setSuccess('');
    
    const token = Cookies.get('token');
    if (!token) {
      setError('No active session. Please login again.');
      setSaving(false);
      return;
    }
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Crear array de profesores con el principal primero
      const allTeachers = [teacherId, ...additionalTeachers];
      
      // Clean schedule times to remove any extra properties
      const cleanedScheduleTimes = scheduleTimes.map(time => ({
        dayOfWeek: time.dayOfWeek,
        startTime: time.startTime,
        endTime: time.endTime,
        isActive: time.isActive
      }));
      
      const courseData = {
        title,
        description,
        coverImageUrl: coverImageUrl || null,
        schoolId,
        isPublic,
        teacher: teacherId,
        teachers: allTeachers,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        // Schedule data
        scheduleTimes: cleanedScheduleTimes,
        enableNotifications,
        notificationMinutes
      };
      
      // Usar la ruta correcta con /api/
      const response = await axios.put(
        `${apiUrl}/api/courses/${id}`,
        courseData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setSuccess('Course updated successfully!');
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/course/${id}`);
      }, 2000);
      
    } catch (error) {
      console.error('Error updating course:', error);
      setError(handleApiError(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.container}>
      <div className={styles.loading}>Loading course information...</div>
    </div>;
  }

  if (!course && !loading) {
    return <div className={styles.container}>
      <div className={styles.error}>Could not find the requested course.</div>
      <div className={styles.buttonContainer}>
        <Link href="/dashboard" className={styles.secondaryButton}>
          Return to Dashboard
        </Link>
      </div>
    </div>;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Edit Course</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
            ></textarea>
          </div>
          
          <div className={styles.formGroup}>
            <label>Course Cover Image</label>
            <ImageUploader 
              onImageUpload={handleImageUpload} 
              defaultImage={coverImageUrl}
              label="Cover Image" 
              className={styles.imageUploader}
            />
            <small className={styles.inputHelp}>Upload an image for your course (optional)</small>
            
            {/* Show preview if there's an image */}
            {coverImageUrl && (
              <ImagePreviewHelper
                imageUrl={coverImageUrl}
                title="Vista previa del curso"
              />
            )}
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="school">School</label>
            <select
              id="school"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
            >
              <option value="">Select a school</option>
              {schools.map((school) => (
                <option key={school._id} value={school._id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {/* Categories Selection */}
          <div className={styles.formGroup}>
            <label htmlFor="categories">Categories (máximo 5)</label>
            {loadingCategories ? (
              <p className={styles.loadingText}>Loading categories...</p>
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
                
                <small className={styles.inputHelp}>
                  Select up to 5 categories to classify your course (optional)
                </small>
              </>
            )}
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="isPublic">Visibility</label>
            <div className={styles.checkboxContainer}>
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <label htmlFor="isPublic" className={styles.checkboxLabel}>
                Make this course public
              </label>
            </div>
          </div>
          
          {/* Profesor principal */}
          <div className={styles.formGroup}>
            <label htmlFor="teacher">Profesor Principal</label>
            <select
              id="teacher"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              required
              disabled={loadingTeachers}
              className={loadingTeachers ? styles.loading : ''}
            >
              <option value="">Seleccionar profesor principal</option>
              {teachers.map((teacher) => (
                <option key={teacher._id} value={teacher._id}>
                  {teacher.name} ({teacher.email})
                </option>
              ))}
            </select>
            {loadingTeachers && <div className={styles.loadingText}>Cargando profesores...</div>}
          </div>

          {/* Profesores adicionales */}
          <div className={styles.formGroup}>
            <label htmlFor="additionalTeachers">Profesores Adicionales</label>
            <select
              id="additionalTeachers"
              onChange={handleAdditionalTeacherChange}
              value=""
              disabled={loadingTeachers}
              className={loadingTeachers ? styles.loading : ''}
            >
              <option value="">Seleccionar profesores adicionales</option>
              {teachers
                .filter(teacher => teacher._id !== teacherId && !additionalTeachers.includes(teacher._id))
                .map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))
              }
            </select>
            
            {/* Lista de profesores adicionales seleccionados */}
            {additionalTeachers.length > 0 && (
              <div className={styles.selectedTeachers}>
                <h4>Profesores Adicionales Seleccionados:</h4>
                <ul className={styles.teacherList}>
                  {additionalTeachers.map((teacherId) => {
                    const teacher = teachers.find(t => t._id === teacherId);
                    return (
                      <li key={teacherId} className={styles.teacherItem}>
                        <span>{teacher ? `${teacher.name} (${teacher.email})` : teacherId}</span>
                        <button 
                          type="button" 
                          onClick={() => removeAdditionalTeacher(teacherId)}
                          className={styles.removeTeacherBtn}
                          title="Eliminar profesor"
                        >
                          <FaTimes />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Schedule Section */}
          <div className={styles.formGroup}>
            <label>Horarios del Curso</label>
            <div className={styles.scheduleSection}>
              <CourseScheduleManager
                scheduleTimes={scheduleTimes}
                enableNotifications={enableNotifications}
                notificationMinutes={notificationMinutes}
                onScheduleTimesChange={setScheduleTimes}
                onEnableNotificationsChange={setEnableNotifications}
                onNotificationMinutesChange={setNotificationMinutes}
              />
            </div>
            <small className={styles.inputHelp}>
              Define los días y horarios de las clases (opcional). Si configuras horarios, se enviarán notificaciones automáticas a los profesores.
            </small>
          </div>
          
          <div className={styles.buttonContainer}>
            <button 
              type="submit" 
              className={styles.primaryButton}
              disabled={saving}
            >
              {saving ? 'Updating...' : 'Update Course'}
            </button>
            
            <Link href={`/course/${id}`} className={styles.secondaryButton}>
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
} 