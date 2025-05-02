import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/PaymentManagement.module.css';
import PaymentNotesModal from '../../components/PaymentNotesModal';
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
  updatedBy?: {
    name: string;
    email: string;
  };
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

interface ModalState {
  isOpen: boolean;
  studentId: string;
  notes: string;
  isPaid: boolean;
}

const PaymentManagement = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [success, setSuccess] = useState<string>('');
  const router = useRouter();
  const { handleApiError } = useApiErrorHandler();
  
  // State for the modal
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    studentId: '',
    notes: '',
    isPaid: false
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus>('pending');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded: DecodedToken = jwtDecode(token);
      if (decoded.role !== 'admin' && decoded.role !== 'school_owner' && decoded.role !== 'super_admin') {
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

  const openPaymentModal = (studentId: string, currentStatus: boolean, currentNotes: string = '') => {
    setModal({
      isOpen: true,
      studentId,
      notes: currentNotes,
      isPaid: !currentStatus // If currently paid, we're marking as unpaid and vice versa
    });
  };

  const closePaymentModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const handlePaymentUpdate = async (studentId: string, isPaid: boolean, notes: string) => {
    try {
      setLoading(true);
      closePaymentModal();
      
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await axios.put(
        `${apiUrl}/api/courses/${selectedCourse}/enrollment/${studentId}`,
        { paymentStatus: isPaid, paymentNotes: notes },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      setSuccess(`Payment status updated successfully`);
      
      // Refresh the enrollment list
      fetchEnrollments(selectedCourse);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      setError(handleApiError(error, 'Error updating payment status'));
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Payment Management</h1>
      
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
      
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
          <table className={styles.enrollmentsTable}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Payment Status</th>
                <th>Last Payment</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <tr key={enrollment._id} className={enrollment.paymentStatus ? styles.paid : styles.unpaid}>
                  <td>{enrollment.student.name}</td>
                  <td>{enrollment.student.email}</td>
                  <td>{enrollment.paymentStatus ? 'Paid' : 'Unpaid'}</td>
                  <td>{enrollment.lastPaymentDate ? new Date(enrollment.lastPaymentDate).toLocaleDateString() : 'N/A'}</td>
                  <td>{enrollment.paymentNotes || 'N/A'}</td>
                  <td>
                    <div className={styles.actionsContainer}>
                      {enrollment.paymentStatus ? (
                        <button 
                          className={styles.unpaidButton}
                          onClick={() => openPaymentModal(
                            enrollment.student._id, 
                            enrollment.paymentStatus,
                            enrollment.paymentNotes
                          )}
                        >
                          Mark as Unpaid
                        </button>
                      ) : (
                        <button 
                          className={styles.paidButton}
                          onClick={() => openPaymentModal(
                            enrollment.student._id, 
                            enrollment.paymentStatus,
                            enrollment.paymentNotes
                          )}
                        >
                          Mark as Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <PaymentNotesModal 
        isOpen={modal.isOpen}
        onClose={closePaymentModal}
        onSave={handlePaymentUpdate}
        initialNotes={modal.notes}
        isPaid={!modal.isPaid}
        studentId={modal.studentId}
      />
    </div>
  );
};

export default PaymentManagement; 