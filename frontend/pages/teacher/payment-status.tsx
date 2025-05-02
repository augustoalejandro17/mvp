import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/PaymentStatus.module.css';
import { useApiErrorHandler } from '../../utils/api-error-handler';

interface Enrollment {
  _id: string;
  student: {
    _id: string;
    name: string;
    email: string;
  };
  course: {
    _id: string;
    title: string;
  };
  paymentStatus: boolean;
  paymentNotes?: string;
  lastPaymentDate?: string;
}

interface Course {
  _id: string;
  title: string;
  school: {
    _id: string;
    name: string;
  };
}

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface PaymentStats {
  total: number;
  paid: number;
  unpaid: number;
}

const PaymentStatus = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const { handleApiError } = useApiErrorHandler();

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      if (decoded.role !== 'teacher' && decoded.role !== 'admin' && decoded.role !== 'super_admin') {
        router.push('/');
        return;
      }

      fetchCourses();
    } catch (error) {
      setError(handleApiError(error, 'Invalid authentication token'));
      router.push('/login');
    }
  }, [router, handleApiError]);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(`${apiUrl}/api/courses`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setCourses(response.data);
      setLoading(false);
    } catch (error) {
      setError(handleApiError(error, 'Error fetching courses'));
      setLoading(false);
    }
  }, [handleApiError]);

  const fetchEnrollments = useCallback(async (courseId: string) => {
    if (!courseId) return;
    
    try {
      setLoading(true);
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(`${apiUrl}/api/courses/${courseId}/enrollments`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setEnrollments(response.data);
      setLoading(false);
    } catch (error) {
      setError(handleApiError(error, 'Error fetching enrollments'));
      setLoading(false);
    }
  }, [handleApiError]);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = e.target.value;
    setSelectedCourse(courseId);
    if (courseId) {
      fetchEnrollments(courseId);
    } else {
      setEnrollments([]);
    }
  };

  // Memoize the payment stats to avoid recalculating on every render
  const paymentStats: PaymentStats = useMemo(() => {
    const total = enrollments.length;
    const paid = enrollments.filter(e => e.paymentStatus).length;
    
    return {
      total,
      paid,
      unpaid: total - paid
    };
  }, [enrollments]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Student Payment Status</h1>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <div className={styles.formGroup}>
        <label htmlFor="course">Select Course:</label>
        <select 
          id="course" 
          className={styles.select}
          value={selectedCourse}
          onChange={handleCourseChange}
        >
          <option value="">-- Select a course --</option>
          {courses.map((course) => (
            <option key={course._id} value={course._id}>
              {course.title} {course.school && `(${course.school.name})`}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className={styles.loading}>Loading...</div>}
      
      {selectedCourse && !loading && enrollments.length === 0 && (
        <div className={styles.message}>No students enrolled in this course</div>
      )}

      {enrollments.length > 0 && (
        <div className={styles.enrollmentsContainer}>
          <h2>Enrolled Students</h2>
          <div className={styles.stats}>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{paymentStats.total}</span>
              <span className={styles.statLabel}>Total Students</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{paymentStats.paid}</span>
              <span className={styles.statLabel}>Paid</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statNumber}>{paymentStats.unpaid}</span>
              <span className={styles.statLabel}>Unpaid</span>
            </div>
          </div>
          <table className={styles.enrollmentsTable}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Payment Status</th>
                <th>Last Payment</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <tr key={enrollment._id} className={enrollment.paymentStatus ? styles.paid : styles.unpaid}>
                  <td>{enrollment.student.name}</td>
                  <td>{enrollment.student.email}</td>
                  <td>
                    <span className={enrollment.paymentStatus ? styles.paidStatus : styles.unpaidStatus}>
                      {enrollment.paymentStatus ? 'Paid' : 'Unpaid'}
                    </span>
                  </td>
                  <td>{enrollment.lastPaymentDate ? new Date(enrollment.lastPaymentDate).toLocaleDateString() : 'N/A'}</td>
                  <td>{enrollment.paymentNotes || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PaymentStatus; 