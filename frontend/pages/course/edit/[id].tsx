import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../../styles/Forms.module.css';
import { useApiErrorHandler } from '../../../utils/api-error-handler';

interface School {
  _id: string;
  name: string;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  school: School | string;
  isPublic: boolean;
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
  
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { handleApiError } = useApiErrorHandler();

  useEffect(() => {
    // Check if there is a token
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Make sure id is a valid string
    if (id && typeof id === 'string') {
      fetchCourse(id, token);
      fetchSchools(token);
    }
  }, [id, router]);

  const fetchCourse = async (courseId: string, token: string) => {
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
      
      setIsPublic(courseData.isPublic || false);
      
    } catch (error) {
      console.error('Error fetching course:', error);
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!title.trim() || !description.trim() || !schoolId) {
      setError('Title, description, and school are required');
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
      
      const courseData = {
        title,
        description,
        coverImageUrl: coverImageUrl || undefined,
        schoolId,
        isPublic
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
            <label htmlFor="coverImageUrl">Cover Image URL (optional)</label>
            <input
              type="url"
              id="coverImageUrl"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
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
          
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Public Course
            </label>
          </div>
          
          <div className={styles.buttonContainer}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
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