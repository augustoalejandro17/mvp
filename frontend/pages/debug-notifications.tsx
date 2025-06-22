import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { getToken } from '../utils/auth';

export default function DebugNotifications() {
  const router = useRouter();
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    fetchCourses();
    fetchUpcomingClasses();
  }, []);

  const fetchCourses = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/courses', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchUpcomingClasses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/debug', {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        setUpcomingClasses(data);
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.message}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerNotificationCheck = async () => {
    try {
      setLoading(true);
      setMessage('');
      
      const response = await fetch('/api/notifications/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'trigger-check' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessage(`Success: ${data.message}`);
        // Refresh upcoming classes
        fetchUpcomingClasses();
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.message}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    if (!selectedCourse) {
      setMessage('Please select a course first');
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      
      const response = await fetch('/api/notifications/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'send-test', 
          courseId: selectedCourse 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessage(`Success: ${data.message}`);
        if (data.notifications) {
          setMessage(prev => prev + `\nNotifications sent: ${JSON.stringify(data.notifications, null, 2)}`);
        }
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.message}`);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>Debug Notifications System</h1>
        
        <div style={{ marginBottom: '30px' }}>
          <h2>Actions</h2>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              onClick={triggerNotificationCheck}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Loading...' : 'Trigger Notification Check'}
            </button>
            
            <button 
              onClick={fetchUpcomingClasses}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Loading...' : 'Refresh Upcoming Classes'}
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>Send Test Notification</h3>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={{
                padding: '10px',
                marginRight: '10px',
                borderRadius: '5px',
                border: '1px solid #ccc'
              }}
            >
              <option value="">Select a course...</option>
              {courses.map((course: any) => (
                <option key={course._id} value={course._id}>
                  {course.title}
                </option>
              ))}
            </select>
            
            <button 
              onClick={sendTestNotification}
              disabled={loading || !selectedCourse}
              style={{
                padding: '10px 20px',
                backgroundColor: '#ffc107',
                color: 'black',
                border: 'none',
                borderRadius: '5px',
                cursor: (loading || !selectedCourse) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Sending...' : 'Send Test Notification'}
            </button>
          </div>

          {message && (
            <div style={{
              padding: '15px',
              backgroundColor: message.includes('Error') ? '#f8d7da' : '#d4edda',
              color: message.includes('Error') ? '#721c24' : '#155724',
              border: `1px solid ${message.includes('Error') ? '#f5c6cb' : '#c3e6cb'}`,
              borderRadius: '5px',
              marginBottom: '20px',
              whiteSpace: 'pre-wrap'
            }}>
              {message}
            </div>
          )}
        </div>

        <div>
          <h2>Upcoming Classes ({upcomingClasses.length})</h2>
          {upcomingClasses.length === 0 ? (
            <p>No upcoming classes found that require notifications.</p>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {upcomingClasses.map((classInfo: any, index) => (
                <div key={index} style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: '#f9f9f9'
                }}>
                  <h3>{classInfo.courseTitle}</h3>
                  <p><strong>Course ID:</strong> {classInfo.courseId}</p>
                  <p><strong>Next Class Time:</strong> {new Date(classInfo.nextClassTime).toLocaleString()}</p>
                  <p><strong>Timezone:</strong> {classInfo.timezone}</p>
                  <p><strong>Notifications Enabled:</strong> {classInfo.enableNotifications ? 'Yes' : 'No'}</p>
                  <p><strong>Notification Minutes:</strong> {classInfo.notificationMinutes}</p>
                  <div>
                    <strong>Schedule Times:</strong>
                    <ul>
                      {classInfo.scheduleTimes.map((time: any, timeIndex: number) => (
                        <li key={timeIndex}>
                          {time.dayOfWeek}: {time.startTime} - {time.endTime} 
                          {time.isActive ? ' (Active)' : ' (Inactive)'}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
} 