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
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // Force re-renders
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUnreadCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Add more frequent polling when there are notifications
  useEffect(() => {
    if (unreadCount > 0) {
      // Poll every 10 seconds when there are unread notifications
      const fastInterval = setInterval(fetchUnreadCount, 10000);
      return () => clearInterval(fastInterval);
    }
  }, [unreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      console.log('🔍 NotificationBell: Token found:', !!token);
      if (!token) {
        console.log('❌ NotificationBell: No token found');
        return;
      }

      console.log('📡 NotificationBell: Fetching unread count...');
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📊 NotificationBell: Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        const newCount = data.unreadCount || data.count || 0;
        console.log('✅ NotificationBell: Current unread count:', unreadCount);
        console.log('✅ NotificationBell: New unread count:', newCount);
        
        if (newCount !== unreadCount) {
          console.log('🔄 NotificationBell: Count changed, updating state');
          setUnreadCount(newCount);
          setLastUpdate(Date.now()); // Force re-render
          
          // Force a re-render by updating a dummy state if needed
          if (newCount > 0 && unreadCount === 0) {
            console.log('🎉 NotificationBell: New notifications detected!');
          }
        } else {
          console.log('⏭️ NotificationBell: Count unchanged');
        }
      } else {
        const errorData = await response.json();
        console.error('❌ NotificationBell: API error:', errorData);
      }
    } catch (error) {
      console.error('💥 NotificationBell: Error fetching unread count:', error);
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

    if (notification.metadata?.actionUrl) {
      router.push(notification.metadata.actionUrl);
    } else if (notification.relatedCourse) {
      router.push(`/course/${notification.relatedCourse._id}`);
    }

    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen && notifications.length === 0) {
      fetchNotifications();
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
    
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (type === 'class_reminder') return '🔔';
    if (type === 'enrollment') return '📚';
    if (type === 'payment_due') return '💰';
    if (priority === 'urgent') return '🚨';
    if (priority === 'high') return '❗';
    return 'ℹ️';
  };

  return (
    <div className={styles.notificationBell} ref={dropdownRef}>
      <button 
        className={styles.bellButton} 
        onClick={toggleDropdown}
        aria-label="Notificaciones"
      >
        <svg className={`${styles.bellIcon} ${unreadCount > 0 ? styles.hasNotifications : ''}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21"/>
        </svg>
        {unreadCount > 0 && (
          <span key={`badge-${unreadCount}-${lastUpdate}`} className={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3>Notificaciones</h3>
            {unreadCount > 0 && (
              <button 
                className={styles.markAllRead}
                onClick={markAllAsRead}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className={styles.content}>
            {loading ? (
              <div className={styles.loading}>Cargando...</div>
            ) : notifications.length === 0 ? (
              <div className={styles.empty}>
                No tienes notificaciones
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`${styles.notification} ${
                    !notification.isRead ? styles.unread : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={styles.icon}>
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>
                  <div className={styles.text}>
                    <div className={styles.title}>{notification.title}</div>
                    <div className={styles.message}>{notification.message}</div>
                    {notification.relatedCourse && (
                      <div className={styles.course}>
                        📚 {notification.relatedCourse.title}
                      </div>
                    )}
                    <div className={styles.time}>
                      {formatTime(notification.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className={styles.footer}>
              <button 
                className={styles.viewAll}
                onClick={() => {
                  router.push('/notifications');
                  setIsOpen(false);
                }}
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