import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../../styles/CourseForm.module.css';
import { useApiErrorHandler } from '../../../utils/api-error-handler';
import ImageUploader from '../../../components/ImageUploader';
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
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  const { handleApiError } = useApiErrorHandler();

  const fetchCourse = useCallback(async (courseId: string, token: string) => {
    setLoading(true);
    setError('');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(
        `${apiUrl}/api/courses/${courseId}`,
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
      
      // Set category
      if (courseData.category) {
        if (typeof courseData.category === 'object' && courseData.category._id) {
          setSelectedCategory(courseData.category._id);
        } else if (typeof courseData.category === 'string') {
          setSelectedCategory(courseData.category);
        }
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
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      // Crear array de profesores con el principal primero
      const allTeachers = [teacherId, ...additionalTeachers];
      
      const courseData = {
        title,
        description,
        coverImageUrl: coverImageUrl || null,
        schoolId,
        isPublic,
        teacher: teacherId,
        teachers: allTeachers,
        category: selectedCategory || undefined
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

          {/* Category Selection */}
          <div className={styles.formGroup}>
            <label htmlFor="categoryId">Category</label>
            {loadingCategories ? (
              <p className={styles.loadingText}>Loading categories...</p>
            ) : (
              <>
                <select
                  id="categoryId"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={styles.select}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <optgroup key={category._id} label={category.name}>
                      <option value={category._id}>{category.name}</option>
                      {category.children && category.children.map((subcategory: any) => (
                        <option key={subcategory._id} value={subcategory._id}>
                          &nbsp;&nbsp;{subcategory.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <small className={styles.inputHelp}>
                  Select a category to classify your course (optional)
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