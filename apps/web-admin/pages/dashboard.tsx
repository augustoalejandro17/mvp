import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../styles/Dashboard.module.css';
import { CardSkeleton, StatsCardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import api from '../utils/api-client';
import { getImageUrl } from '../utils/image-utils';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string | string[];
}

interface DashboardStats {
  totalCourses?: number;
  activeCourses?: number;
  totalStudents?: number;
  attendanceRate?: number;
  completionRate?: number;
  upcomingClasses?: number;
  recentActivity?: Activity[];
}

interface Activity {
  id: string;
  type: 'enrollment' | 'completion' | 'attendance' | 'class';
  title: string;
  description: string;
  timestamp: string;
}

interface Course {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  progress?: number;
}

// Helper to get primary role
const getPrimaryRole = (role: string | string[]): string => {
  if (Array.isArray(role)) {
    const adminRoles = ['super_admin', 'school_owner', 'administrative', 'admin'];
    for (const r of role) {
      if (adminRoles.includes(r.toLowerCase())) return r;
    }
    if (role.includes('teacher') || role.includes('TEACHER')) return 'teacher';
    return role[0];
  }
  return role;
};

// Stats Card Component
const StatCard = ({ 
  icon, 
  label, 
  value, 
  trend, 
  trendLabel,
  color = 'primary'
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  trend?: number;
  trendLabel?: string;
  color?: 'primary' | 'success' | 'warning' | 'info';
}) => (
  <div className={`${styles.statCard} ${styles[`statCard${color.charAt(0).toUpperCase() + color.slice(1)}`]}`}>
    <div className={styles.statIcon}>{icon}</div>
    <div className={styles.statContent}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {trend !== undefined && (
        <span className={`${styles.statTrend} ${trend >= 0 ? styles.positive : styles.negative}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% {trendLabel}
        </span>
      )}
    </div>
  </div>
);

// Quick Action Button
const QuickAction = ({ 
  icon, 
  label, 
  href, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  href?: string;
  onClick?: () => void;
}) => {
  if (href) {
    return (
      <Link href={href} className={styles.quickAction}>
        <span className={styles.quickActionIcon}>{icon}</span>
        <span className={styles.quickActionLabel}>{label}</span>
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={styles.quickAction}>
      <span className={styles.quickActionIcon}>{icon}</span>
      <span className={styles.quickActionLabel}>{label}</span>
    </button>
  );
};

// Course Card Component
const CourseCard = ({ course }: { course: Course }) => (
  <Link href={`/course/${course._id}`} className={styles.courseCard}>
    <div className={styles.courseImage}>
      {course.imageUrl ? (
        <img src={getImageUrl(course.imageUrl)} alt={course.title} />
      ) : (
        <div className={styles.coursePlaceholder}>
          <span>📚</span>
        </div>
      )}
    </div>
    <div className={styles.courseInfo}>
      <h4 className={styles.courseTitle}>{course.title}</h4>
      {course.progress !== undefined && (
        <div className={styles.courseProgress}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${course.progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{course.progress}%</span>
        </div>
      )}
    </div>
  </Link>
);

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [stats, setStats] = useState<DashboardStats>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (token: string, role: string) => {
    try {
      // Fetch stats based on role
      const normalizedRole = role.toLowerCase();
      
      if (['super_admin', 'school_owner', 'administrative', 'admin'].some(r => normalizedRole.includes(r))) {
        // Admin dashboard data
        try {
          const [statsRes] = await Promise.all([
            api.get('/stats/overview').catch(() => ({ data: {} })),
          ]);
          setStats({
            totalStudents: statsRes.data.totalStudents || 0,
            totalCourses: statsRes.data.totalCourses || 0,
            attendanceRate: statsRes.data.attendanceRate || 0,
          });
        } catch (e) {
          console.error('Error fetching admin stats:', e);
        }
      } else if (normalizedRole.includes('teacher')) {
        // Teacher dashboard data
        try {
          const coursesRes = await api.get('/courses/my-courses').catch(() => ({ data: [] }));
          setCourses(Array.isArray(coursesRes.data) ? coursesRes.data.slice(0, 4) : []);
          setStats({
            activeCourses: Array.isArray(coursesRes.data) ? coursesRes.data.length : 0,
          });
        } catch (e) {
          console.error('Error fetching teacher data:', e);
        }
      } else {
        // Student dashboard data
        try {
          const enrolledRes = await api.get('/courses/enrolled').catch(() => ({ data: [] }));
          const coursesData = Array.isArray(enrolledRes.data) ? enrolledRes.data : [];
          setCourses(coursesData.slice(0, 4));
          setStats({
            activeCourses: coursesData.length,
            completionRate: coursesData.length > 0 
              ? Math.round(coursesData.reduce((acc: number, c: Course) => acc + (c.progress || 0), 0) / coursesData.length)
              : 0,
          });
        } catch (e) {
          console.error('Error fetching student data:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Error al cargar los datos del dashboard');
    }
  }, []);

  useEffect(() => {
    const initDashboard = async () => {
      const token = Cookies.get('token');
      
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const decoded = jwtDecode<DecodedToken>(token);
        const primaryRole = getPrimaryRole(decoded.role);
        
        setUser({
          name: decoded.name,
          role: primaryRole,
        });

        await fetchDashboardData(token, primaryRole);
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, [router, fetchDashboardData]);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  // Get role-specific quick actions
  const getQuickActions = () => {
    const role = user?.role?.toLowerCase() || '';
    
    if (['super_admin', 'school_owner', 'administrative', 'admin'].some(r => role.includes(r))) {
      return [
        { icon: '👥', label: 'Usuarios', href: '/admin/users' },
        { icon: '📊', label: 'Estadísticas', href: '/admin/stats' },
        { icon: '🏫', label: 'Escuelas', href: '/admin/schools' },
        { icon: '📁', label: 'Carga masiva', href: '/admin/bulk-upload' },
      ];
    }
    
    if (role.includes('teacher')) {
      return [
        { icon: '➕', label: 'Crear curso', href: '/course/create' },
        { icon: '📋', label: 'Asistencia', href: '/teacher/attendance-management' },
        { icon: '💳', label: 'Pagos', href: '/teacher/payment-status' },
        { icon: '📚', label: 'Mis cursos', href: '/community?tab=courses' },
      ];
    }
    
    return [
      { icon: '📚', label: 'Mis cursos', href: '/community?tab=courses' },
      { icon: '🔍', label: 'Explorar', href: '/' },
      { icon: '👤', label: 'Mi perfil', href: '/profile' },
      { icon: '🔔', label: 'Notificaciones', href: '/notifications' },
    ];
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.greeting}>
            <div className="skeleton" style={{ width: '200px', height: '32px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ width: '150px', height: '20px', borderRadius: '6px', marginTop: '8px' }} />
          </div>
        </div>
        <div className={styles.statsGrid}>
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
        <div className={styles.coursesSection}>
          <div className={styles.coursesGrid}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <EmptyState 
          variant="error"
          title="Error al cargar"
          description={error}
          actionLabel="Reintentar"
          onAction={() => window.location.reload()}
        />
      </div>
    );
  }

  const role = user?.role?.toLowerCase() || '';
  const isAdmin = ['super_admin', 'school_owner', 'administrative', 'admin'].some(r => role.includes(r));
  const isTeacher = role.includes('teacher');

  return (
    <div className={styles.container}>
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />
      
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.greeting}>
          <h1>{getGreeting()}, {user?.name?.split(' ')[0] || 'Usuario'} 👋</h1>
          <p className={styles.subtitle}>
            {isAdmin 
              ? 'Aquí está el resumen de tu academia'
              : isTeacher 
                ? 'Gestiona tus cursos y estudiantes'
                : 'Continúa tu aprendizaje donde lo dejaste'}
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className={styles.quickActions}>
          {getQuickActions().map((action, index) => (
            <QuickAction key={index} {...action} />
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {isAdmin ? (
          <>
            <StatCard
              icon="👥"
              label="Total Estudiantes"
              value={stats.totalStudents || 0}
              trend={5}
              trendLabel="este mes"
              color="primary"
            />
            <StatCard
              icon="📚"
              label="Cursos Activos"
              value={stats.totalCourses || 0}
              color="info"
            />
            <StatCard
              icon="✅"
              label="Asistencia Promedio"
              value={`${stats.attendanceRate || 0}%`}
              trend={3}
              trendLabel="vs mes anterior"
              color="success"
            />
            <StatCard
              icon="📈"
              label="Tasa de Retención"
              value="92%"
              trend={2}
              color="warning"
            />
          </>
        ) : isTeacher ? (
          <>
            <StatCard
              icon="📚"
              label="Mis Cursos"
              value={stats.activeCourses || 0}
              color="primary"
            />
            <StatCard
              icon="👥"
              label="Total Estudiantes"
              value={stats.totalStudents || '-'}
              color="info"
            />
            <StatCard
              icon="✅"
              label="Clases esta semana"
              value={stats.upcomingClasses || 0}
              color="success"
            />
            <StatCard
              icon="💰"
              label="Pagos Pendientes"
              value={0}
              color="warning"
            />
          </>
        ) : (
          <>
            <StatCard
              icon="📚"
              label="Cursos Activos"
              value={stats.activeCourses || 0}
              color="primary"
            />
            <StatCard
              icon="🎯"
              label="Progreso General"
              value={`${stats.completionRate || 0}%`}
              color="success"
            />
            <StatCard
              icon="🏆"
              label="Certificados"
              value={0}
              color="warning"
            />
            <StatCard
              icon="⭐"
              label="Puntos"
              value={0}
              color="info"
            />
          </>
        )}
      </div>

      {/* Courses Section */}
      <div className={styles.coursesSection}>
        <div className={styles.sectionHeader}>
          <h2>{isTeacher ? 'Mis cursos' : 'Continúa aprendiendo'}</h2>
          <Link href="/community?tab=courses" className={styles.viewAllLink}>
            Ver todos →
          </Link>
        </div>
        
        {courses.length > 0 ? (
          <div className={styles.coursesGrid}>
            {courses.map((course) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </div>
        ) : (
          <EmptyState
            variant="no-courses"
            title={isTeacher ? 'Sin cursos creados' : 'Sin cursos inscritos'}
            description={isTeacher 
              ? 'Crea tu primer curso para comenzar a enseñar'
              : 'Explora el catálogo y encuentra cursos que te interesen'}
            actionLabel={isTeacher ? 'Crear curso' : 'Explorar cursos'}
            onAction={() => router.push(isTeacher ? '/course/create' : '/')}
          />
        )}
      </div>

      {/* Recent Activity (for admins/teachers) */}
      {(isAdmin || isTeacher) && (
        <div className={styles.activitySection}>
          <div className={styles.sectionHeader}>
            <h2>Actividad reciente</h2>
          </div>
          <div className={styles.activityList}>
            <EmptyState
              variant="no-data"
              title="Sin actividad reciente"
              description="La actividad de tus cursos aparecerá aquí"
            />
          </div>
        </div>
      )}
    </div>
  );
}
