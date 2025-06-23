import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/NotificationBell.module.css';

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
}

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isVisible, setIsVisible] = useState(true);
  const [pollInterval, setPollInterval] = useState(60000); // Start with 1 minute
  const dropdownRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Mobile and visibility optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      
      if (visible) {
        // When tab becomes visible, fetch immediately and reset to normal polling
        fetchUnreadCount();
        setPollInterval(60000); // Reset to 1 minute
      }
    };

    const handleFocus = () => {
      setIsVisible(true);
      fetchUnreadCount();
    };

    const handleBlur = () => {
      setIsVisible(false);
    };

    // Check if user is on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Smart polling with exponential backoff
  useEffect(() => {
    const startPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      const poll = () => {
        if (isVisible) {
          fetchUnreadCount();
        }
      };

      // Initial fetch
      poll();

      // Set up interval based on current state
      let currentInterval = pollInterval;
      
      // Reduce polling when tab is not visible
      if (!isVisible) {
        currentInterval = Math.min(pollInterval * 3, 300000); // Max 5 minutes when not visible
      }

      // Increase polling frequency if there are unread notifications
      if (unreadCount > 0 && isVisible) {
        currentInterval = Math.max(30000, pollInterval / 2); // Min 30 seconds when there are notifications
      }

      intervalRef.current = setInterval(poll, currentInterval);
    };

    startPolling();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible, unreadCount, pollInterval]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Use both mouse and touch events for better mobile support
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) {
        // Increase poll interval when not authenticated
        setPollInterval(prev => Math.min(prev * 1.5, 300000));
        return;
      }

      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newCount = data.unreadCount || data.count || 0;
        
        if (newCount !== unreadCount) {
          setUnreadCount(newCount);
          setLastUpdate(Date.now());
          
          // Reset poll interval on successful update
          setPollInterval(60000);
        } else {
          // Gradually increase poll interval if no changes (exponential backoff)
          setPollInterval(prev => Math.min(prev * 1.2, 180000)); // Max 3 minutes
        }
      } else {
        // Increase poll interval on error
        setPollInterval(prev => Math.min(prev * 2, 300000));
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      // Increase poll interval on error
      setPollInterval(prev => Math.min(prev * 2, 300000));
    }
  }, [unreadCount]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) return;

      const response = await fetch('/api/notifications?limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: NotificationResponse = await response.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
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

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    // Navigate to related content
    if (notification.metadata?.actionUrl) {
      router.push(notification.metadata.actionUrl);
    } else if (notification.relatedCourse) {
      router.push(`/course/${notification.relatedCourse._id}`);
    }

    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const baseClass = styles.notificationIcon;
    const priorityClass = priority === 'high' ? styles.highPriority : 
                         priority === 'medium' ? styles.mediumPriority : styles.lowPriority;
    
    switch (type) {
      case 'class_reminder':
        return <span className={`${baseClass} ${priorityClass}`}>📚</span>;
      case 'enrollment':
        return <span className={`${baseClass} ${priorityClass}`}>👥</span>;
      case 'payment_due':
        return <span className={`${baseClass} ${priorityClass}`}>💳</span>;
      case 'system':
        return <span className={`${baseClass} ${priorityClass}`}>⚙️</span>;
      default:
        return <span className={`${baseClass} ${priorityClass}`}>📢</span>;
    }
  };

  return (
    <div className={styles.notificationContainer} ref={dropdownRef}>
      <button 
        className={styles.notificationButton}
        onClick={toggleDropdown}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
        type="button"
      >
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={styles.bellIcon}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span key={`badge-${lastUpdate}-${unreadCount}`} className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h3>Notificaciones</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className={styles.markAllButton}
                type="button"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          
          <div className={styles.notificationsList}>
            {loading ? (
              <div className={styles.loading}>Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🔔</span>
                <p>No tienes notificaciones</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`${styles.notificationItem} ${!notification.isRead ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleNotificationClick(notification);
                    }
                  }}
                >
                  <div className={styles.notificationContent}>
                    <div className={styles.notificationHeader}>
                      {getNotificationIcon(notification.type, notification.priority)}
                      <span className={styles.notificationTitle}>
                        {notification.title}
                      </span>
                      <span className={styles.notificationTime}>
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className={styles.notificationMessage}>
                      {notification.message}
                    </p>
                    {notification.relatedCourse && (
                      <div className={styles.courseInfo}>
                        📚 {notification.relatedCourse.title}
                      </div>
                    )}
                  </div>
                  {!notification.isRead && <div className={styles.unreadDot} />}
                </div>
              ))
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className={styles.dropdownFooter}>
              <button 
                onClick={() => {
                  router.push('/notifications');
                  setIsOpen(false);
                }}
                className={styles.viewAllButton}
                type="button"
              >
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell; 