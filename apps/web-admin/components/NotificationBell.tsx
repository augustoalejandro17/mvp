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

interface GroupedNotifications {
  today: Notification[];
  thisWeek: Notification[];
  older: Notification[];
}

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [pollInterval, setPollInterval] = useState(60000);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Visibility optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsVisible(visible);
      if (visible) {
        fetchUnreadCount();
        setPollInterval(60000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Smart polling
  useEffect(() => {
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);

      const poll = () => {
        if (isVisible) fetchUnreadCount();
      };

      poll();
      
      let currentInterval = pollInterval;
      if (!isVisible) currentInterval = Math.min(pollInterval * 3, 300000);
      if (unreadCount > 0 && isVisible) currentInterval = Math.max(30000, pollInterval / 2);

      intervalRef.current = setInterval(poll, currentInterval);
    };

    startPolling();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isVisible, unreadCount, pollInterval]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

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
        setPollInterval(prev => Math.min(prev * 1.5, 300000));
        return;
      }

      const response = await fetch('/api/notifications/unread-count', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const newCount = data.unreadCount || data.count || 0;
        if (newCount !== unreadCount) {
          setUnreadCount(newCount);
          setPollInterval(60000);
        } else {
          setPollInterval(prev => Math.min(prev * 1.2, 180000));
        }
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
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

      const response = await fetch('/api/notifications?limit=20', {
        headers: { 'Authorization': `Bearer ${token}` },
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

  const markAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1];

      if (!token) return;

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
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
        headers: { 'Authorization': `Bearer ${token}` },
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
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  // Format time in a human-readable way
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Ahora';
    if (diffInMinutes < 60) return `hace ${diffInMinutes} min`;
    if (diffInHours < 24) return `hace ${diffInHours}h`;
    if (diffInDays === 1) return 'Ayer';
    if (diffInDays < 7) return `hace ${diffInDays} días`;
    if (diffInDays < 30) return `hace ${Math.floor(diffInDays / 7)} sem`;
    if (diffInDays < 365) return `hace ${Math.floor(diffInDays / 30)} meses`;
    return `hace ${Math.floor(diffInDays / 365)} años`;
  };

  // Group notifications by date
  const groupNotifications = (notifs: Notification[]): GroupedNotifications => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return notifs.reduce(
      (groups, notification) => {
        const date = new Date(notification.createdAt);
        if (date >= today) {
          groups.today.push(notification);
        } else if (date >= weekAgo) {
          groups.thisWeek.push(notification);
        } else {
          groups.older.push(notification);
        }
        return groups;
      },
      { today: [], thisWeek: [], older: [] } as GroupedNotifications
    );
  };

  // Get icon based on notification type
  const getNotificationIcon = (type: string): React.ReactNode => {
    const icons: Record<string, { icon: string; bg: string }> = {
      'class_reminder': { icon: '🎓', bg: 'var(--color-info-100, #dbeafe)' },
      'enrollment': { icon: '✅', bg: 'var(--color-success-100, #d1fae5)' },
      'payment_due': { icon: '💳', bg: 'var(--color-warning-100, #fef3c7)' },
      'payment_received': { icon: '💰', bg: 'var(--color-success-100, #d1fae5)' },
      'system': { icon: '⚙️', bg: 'var(--color-gray-100, #f3f4f6)' },
      'achievement': { icon: '🏆', bg: 'var(--color-primary-100, #fef3c7)' },
      'video_completed': { icon: '🎬', bg: 'var(--color-primary-100, #fef3c7)' },
      'badge_earned': { icon: '🎖️', bg: 'var(--color-primary-100, #fef3c7)' },
      'course_update': { icon: '📚', bg: 'var(--color-info-100, #dbeafe)' },
      'message': { icon: '💬', bg: 'var(--color-info-100, #dbeafe)' },
    };

    const { icon, bg } = icons[type] || { icon: '🔔', bg: 'var(--color-gray-100, #f3f4f6)' };

    return (
      <span className={styles.iconWrapper} style={{ backgroundColor: bg }}>
        {icon}
      </span>
    );
  };

  const groupedNotifications = groupNotifications(notifications);
  const hasNotifications = notifications.length > 0;

  const renderNotificationItem = (notification: Notification) => (
    <div
      key={notification._id}
      className={`${styles.notificationItem} ${!notification.isRead ? styles.unread : ''}`}
      onClick={() => handleNotificationClick(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(notification);
      }}
    >
      {!notification.isRead && <div className={styles.unreadIndicator} />}
      
      <div className={styles.iconContainer}>
        {getNotificationIcon(notification.type)}
      </div>
      
      <div className={styles.notificationContent}>
        <div className={styles.notificationHeader}>
          <span className={styles.notificationTitle}>{notification.title}</span>
          <span className={styles.notificationTime}>{formatTime(notification.createdAt)}</span>
        </div>
        <p className={styles.notificationMessage}>{notification.message}</p>
        {notification.relatedCourse && (
          <span className={styles.courseTag}>
            📚 {notification.relatedCourse.title}
          </span>
        )}
      </div>

      {!notification.isRead && (
        <button
          className={styles.markReadButton}
          onClick={(e) => markAsRead(notification._id, e)}
          title="Marcar como leída"
          aria-label="Marcar como leída"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      )}
    </div>
  );

  const renderGroup = (title: string, notifs: Notification[]) => {
    if (notifs.length === 0) return null;
    return (
      <div className={styles.notificationGroup}>
        <div className={styles.groupHeader}>{title}</div>
        {notifs.map(renderNotificationItem)}
      </div>
    );
  };

  return (
    <div className={styles.notificationContainer} ref={dropdownRef}>
      <button
        className={styles.notificationButton}
        onClick={toggleDropdown}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
        aria-expanded={isOpen}
        type="button"
      >
        <svg
          width="22"
          height="22"
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
          <span className={styles.badge}>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Marcar todas
              </button>
            )}
          </div>

          <div className={styles.notificationsList}>
            {loading ? (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner} />
                <span>Cargando...</span>
              </div>
            ) : !hasNotifications ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <p className={styles.emptyTitle}>Sin notificaciones</p>
                <p className={styles.emptySubtitle}>Cuando tengas notificaciones aparecerán aquí</p>
              </div>
            ) : (
              <>
                {renderGroup('Hoy', groupedNotifications.today)}
                {renderGroup('Esta semana', groupedNotifications.thisWeek)}
                {renderGroup('Anteriores', groupedNotifications.older)}
              </>
            )}
          </div>

          {hasNotifications && (
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;