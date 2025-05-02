import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import VideoPlayer from '../../components/VideoPlayer';
import Layout from '../../components/Layout';
import styles from '../../styles/ClassDetail.module.css';
import { UserRole } from '../../types/user';

// Interfaces
interface Class {
  _id: string;
  title: string;
  description: string;
  courseId: string;
  order: number;
  videoUrl: string;
  createdBy: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  isPublic: boolean;
}

interface DecodedToken {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

const ClassDetail: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [classData, setClassData] = useState<Class | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login');
        return false;
      }

      try {
        const decoded = jwtDecode<DecodedToken>(token);
        setUserRole(decoded.role);
        return true;
      } catch (err) {
        Cookies.remove('token');
        router.push('/login');
        return false;
      }
    };

    const fetchClassData = async () => {
      if (!id || !checkAuth()) return;

      try {
        setLoading(true);
        const response = await fetch(`/api/classes/${id}`, {
          headers: {
            'Authorization': `Bearer ${Cookies.get('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch class data');
        }
        
        const data = await response.json();
        setClassData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchClassData();
    }
  }, [id, router]);

  const handleDeleteClass = async () => {
    if (!classData) return;
    
    const confirmDelete = confirm('Are you sure you want to delete this class?');
    if (!confirmDelete) return;

    try {
      const response = await fetch(`/api/classes/${classData._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Cookies.get('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete class');
      }
      
      router.push(`/course/${classData.courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleTogglePublic = async () => {
    if (!classData) return;

    try {
      const response = await fetch(`/api/classes/${classData._id}/toggle-public`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${Cookies.get('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isPublic: !classData.isPublic
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update class visibility');
      }
      
      const updatedClass = await response.json();
      setClassData(updatedClass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const isTeacherOrAdmin = () => {
    return userRole && [UserRole.TEACHER, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN].includes(userRole);
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.loading}>Loading class information...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className={styles.error}>{error}</div>
      </Layout>
    );
  }

  if (!classData) {
    return (
      <Layout>
        <div className={styles.error}>Class not found</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.classDetail}>
        <h1 className={styles.title}>{classData.title}</h1>
        
        {classData.videoUrl && (
          <div className={styles.videoContainer}>
            <VideoPlayer 
              url={classData.videoUrl} 
              title={classData.title} 
              classId={classData._id}
            />
          </div>
        )}
        
        <div className={styles.description}>
          <h2>Description</h2>
          <p>{classData.description}</p>
        </div>
        
        <div className={styles.teacherInfo}>
          <h3>Teacher</h3>
          <p>{classData.createdBy.firstName} {classData.createdBy.lastName}</p>
          <p>{classData.createdBy.email}</p>
        </div>
        
        {isTeacherOrAdmin() && (
          <div className={styles.adminActions}>
            <button 
              className={styles.editButton}
              onClick={() => router.push(`/class/edit/${classData._id}`)}
            >
              Edit Class
            </button>
            <button 
              className={styles.deleteButton}
              onClick={handleDeleteClass}
            >
              Delete Class
            </button>
            <button 
              className={`${styles.publicButton} ${classData.isPublic ? styles.public : styles.private}`}
              onClick={handleTogglePublic}
            >
              {classData.isPublic ? 'Mark as Private' : 'Mark as Public'}
            </button>
            <button 
              className={styles.backButton}
              onClick={() => router.push(`/course/${classData.courseId}`)}
            >
              Back to Course
            </button>
          </div>
        )}
        
        {!isTeacherOrAdmin() && (
          <button 
            className={styles.backButton}
            onClick={() => router.push(`/course/${classData.courseId}`)}
          >
            Back to Course
          </button>
        )}
      </div>
    </Layout>
  );
};

export default ClassDetail;