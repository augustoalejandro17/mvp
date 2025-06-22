import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import styles from '../styles/Notifications.module.css';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  relatedCourse?: {
    _id: string;
    title: string;
  };
  metadata?: {
    actionUrl?: string;
    classStartTime?: string;
    courseId?: string;
  };
}

interface NotificationResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  currentPage: number;
  totalPages: number;
}

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();
  }, [currentPage, filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        router.push('/login');
        return;
      }

      const unreadOnly = filter === 'unread' ? 'true' : 'false';
      const response = await fetch(`/api/notifications?page=${currentPage}&limit=20&unreadOnly=${unreadOnly}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: NotificationResponse = await response.json();
        setNotifications(data.notifications);
        setTotalPages(data.totalPages);
        setUnreadCount(data.unreadCount);
      } else if (response.status === 401) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) return;

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n._id === notificationId ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) return;

      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent notification click
    
    // Simple confirmation
    if (!confirm('¿Estás seguro de que quieres eliminar esta notificación?')) {
      return;
    }
    
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) return;

      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Immediately remove from local state
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        
        // If the deleted notification was unread, decrease the count
        const deletedNotification = notifications.find(n => n._id === notificationId);
        if (deletedNotification && !deletedNotification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        
        // Refresh to ensure backend consistency
        setTimeout(() => {
          fetchNotifications();
        }, 500);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    if (notification.metadata?.actionUrl) {
      router.push(notification.metadata.actionUrl);
    } else if (notification.relatedCourse) {
      router.push(`/course/${notification.relatedCourse._id}`);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Ahora mismo';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
    if (diffInHours < 24) return `Hace ${diffInHours}h`;
    if (diffInDays < 7) return `Hace ${diffInDays}d`;
    
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (type === 'class_reminder') return '🔔';
    if (type === 'enrollment') return '📚';
    if (type === 'payment_due') return '💰';
    if (priority === 'urgent') return '🚨';
    if (priority === 'high') return '❗';
    return 'ℹ️';
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'urgent': return styles.urgent;
      case 'high': return styles.high;
      case 'medium': return styles.medium;
      default: return styles.low;
    }
  };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Notificaciones</h1>
          <div className={styles.actions}>
            {unreadCount > 0 && (
              <button 
                className={styles.markAllButton}
                onClick={markAllAsRead}
              >
                Marcar todas como leídas ({unreadCount})
              </button>
            )}
          </div>
        </div>

        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => {
              setFilter('all');
              setCurrentPage(1);
            }}
          >
            Todas
          </button>
          <button
            className={`${styles.filterButton} ${filter === 'unread' ? styles.active : ''}`}
            onClick={() => {
              setFilter('unread');
              setCurrentPage(1);
            }}
          >
            No leídas ({unreadCount})
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Cargando notificaciones...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔔</div>
              <h3>No tienes notificaciones</h3>
              <p>
                {filter === 'unread' 
                  ? 'No hay notificaciones sin leer' 
                  : 'Cuando recibas notificaciones, aparecerán aquí'
                }
              </p>
            </div>
          ) : (
            <div className={styles.notificationsList}>
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`${styles.notification} ${
                    !notification.isRead ? styles.unread : ''
                  } ${getPriorityClass(notification.priority)}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={styles.notificationIcon}>
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>
                  
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationHeader}>
                      <h4 className={styles.title}>{notification.title}</h4>
                      <span className={styles.time}>
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    
                    <p className={styles.message}>{notification.message}</p>
                    
                    {notification.relatedCourse && (
                      <div className={styles.course}>
                        <span className={styles.courseIcon}>📚</span>
                        {notification.relatedCourse.title}
                      </div>
                    )}
                    
                    <div className={styles.notificationMeta}>
                      <span className={`${styles.type} ${styles[notification.type]}`}>
                        {notification.type === 'class_reminder' && 'Recordatorio de clase'}
                        {notification.type === 'enrollment' && 'Inscripción'}
                        {notification.type === 'payment_due' && 'Pago pendiente'}
                        {notification.type === 'general' && 'General'}
                        {notification.type === 'system' && 'Sistema'}
                      </span>
                      
                      {notification.priority !== 'low' && (
                        <span className={`${styles.priority} ${getPriorityClass(notification.priority)}`}>
                          {notification.priority === 'urgent' && 'Urgente'}
                          {notification.priority === 'high' && 'Alta'}
                          {notification.priority === 'medium' && 'Media'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.notificationActions}>
                    <button
                      className={styles.deleteButton}
                      onClick={(e) => deleteNotification(notification._id, e)}
                      title="Eliminar notificación"
                      aria-label="Eliminar notificación"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                      </svg>
                    </button>
                  </div>
                  
                  {!notification.isRead && (
                    <div className={styles.unreadDot}></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageButton}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← Anterior
            </button>
            
            <div className={styles.pageNumbers}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  className={`${styles.pageNumber} ${currentPage === page ? styles.active : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              className={styles.pageButton}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage; 