import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../styles/Community.module.css';
import Layout from '../components/Layout';
import { leaderboardApi, pointsApi } from '../utils/gamification-api';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  points: number;
  rank: number;
  level: number;
  streak: number;
  userAvatar?: string;
  previousRank?: number;
  badges?: number;
  lastActivity?: Date;
  isActive?: boolean;
  specialTitles?: string[];
  rankChange?: number;
}

interface Course {
  id: string;
  title: string;
  description: string;
  progress: number;
  instructor: string;
  status: 'active' | 'completed' | 'paused';
}

interface Friend {
  id: string;
  name: string;
  level: string;
  points: number;
  status: 'online' | 'offline';
  lastSeen: string;
}

// Helper function to calculate course progress based on completed classes
const calculateCourseProgress = (course: any): number => {
  if (!course) return 0;
  
  // Get total classes in the course
  const totalClasses = course.classes ? course.classes.length : 0;
  
  if (totalClasses === 0) {
    // No classes uploaded yet - show progress based on course setup/age
    const createdAt = new Date(course.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // Show minimal progress for course setup/planning phase
    if (daysSinceCreation < 7) return 5; // Just created
    if (daysSinceCreation < 30) return 15; // Planning phase
    return 25; // Long-term planning
  }
  
  // For courses with classes, simulate completion based on course age
  // In a real implementation, this would check actual user completion data
  const createdAt = new Date(course.createdAt);
  const now = new Date();
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // Simulate realistic completion: 1 class per week
  let completedClasses = 0;
  if (daysSinceCreation >= 7) {
    completedClasses = Math.min(Math.floor(daysSinceCreation / 7), totalClasses);
  }
  
  // Calculate percentage
  const progressPercentage = Math.round((completedClasses / totalClasses) * 100);
  
  return Math.min(progressPercentage, 100); // Cap at 100%
};

// Helper function to get real course progress from API
const getRealCourseProgress = async (course: any, userId: string): Promise<number> => {
  if (!course || !userId) return 0;
  
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const response = await fetch(`${apiUrl}/api/progress/public/course/${course._id}/user/${userId}`);
    
    if (response.ok) {
      const progressData = await response.json();
      if (progressData && progressData.completionPercentage !== undefined) {
        return progressData.completionPercentage;
      }
    }
    
    // If API fails, return 0% instead of simulated progress
    console.log('Progress API failed for course:', course._id, 'user:', userId);
    return 0;
  } catch (error) {
    console.error('Error fetching real course progress:', error);
    // Return 0% instead of simulated progress
    return 0;
  }
};

// Helper function to calculate course progress including classes in playlists (fallback)
const calculateCourseProgressWithPlaylists = async (course: any): Promise<number> => {
  if (!course) return 0;
  
  try {
    // Get playlists for this course
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const playlistsResponse = await fetch(`${apiUrl}/api/playlists?courseId=${course._id}`);
    
    let totalClasses = 0;
    
    if (playlistsResponse.ok) {
      const playlists = await playlistsResponse.json();
      // Count classes in all playlists
      totalClasses = playlists.reduce((sum: number, playlist: any) => {
        return sum + (playlist.classes ? playlist.classes.length : 0);
      }, 0);
    }
    
    // Also add direct classes (not in playlists)
    const directClasses = course.classes ? course.classes.length : 0;
    totalClasses += directClasses;
    
    if (totalClasses === 0) {
      // No classes uploaded yet - show progress based on course setup/age
      const createdAt = new Date(course.createdAt);
      const now = new Date();
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Show minimal progress for course setup/planning phase
      if (daysSinceCreation < 7) return 5; // Just created
      if (daysSinceCreation < 30) return 15; // Planning phase
      return 25; // Long-term planning
    }
    
    // For courses with classes, simulate completion based on course age
    // In a real implementation, this would check actual user completion data
    const createdAt = new Date(course.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // Simulate realistic completion: 1 class per week
    let completedClasses = 0;
    if (daysSinceCreation >= 7) {
      completedClasses = Math.min(Math.floor(daysSinceCreation / 7), totalClasses);
    }
    
    // Calculate percentage
    const progressPercentage = Math.round((completedClasses / totalClasses) * 100);
    
    return Math.min(progressPercentage, 100); // Cap at 100%
  } catch (error) {
    console.error('Error calculating course progress with playlists:', error);
    // Fallback to basic calculation
    return calculateCourseProgress(course);
  }
};

export default function Community() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('courses'); // Default to courses instead of leaderboard
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      setUser({
        id: decoded.sub,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role
      });
      
      // Load initial data
      loadData(decoded.sub);
    } catch (error) {
      console.error('Error decoding token:', error);
      router.push('/login');
    }
  }, [router]);

  // Handle URL parameters for tab selection
  useEffect(() => {
    if (router.query.tab) {
      const tab = router.query.tab as string;
      if (tab === 'leaderboard' || tab === 'courses') {
        setActiveTab(tab);
      }
    }
  }, [router.query]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    // Update URL without triggering a full page reload
    router.push(`/community?tab=${newTab}`, undefined, { shallow: true });
  };

  const loadData = async (userId: string) => {
    setLoading(true);
    try {
      // Load real global leaderboard data
      const leaderboardResponse = await leaderboardApi.getGlobalLeaderboard('all_time', 20);
      
      // Check if the response has data property or if it's the data directly
      const leaderboardData = leaderboardResponse.data || leaderboardResponse;
      
      if (leaderboardData && Array.isArray(leaderboardData) && leaderboardData.length > 0) {
        // Transform the data to match our interface
        const transformedData = leaderboardData.map((entry: any, index: number) => ({
          userId: entry.userId,
          userName: entry.userName,
          points: entry.points,
          rank: entry.rank || index + 1,
          level: entry.level || 1,
          streak: entry.streak || 0,
          userAvatar: entry.userAvatar,
          previousRank: entry.previousRank,
          badges: entry.badges,
          lastActivity: entry.lastActivity,
          isActive: entry.isActive,
          specialTitles: entry.specialTitles,
          rankChange: entry.rankChange,
        }));
        
        setLeaderboard(transformedData);
      } else {
        // Show empty leaderboard when no data is available
        setLeaderboard([]);
      }

      // Load real courses data - enrolled for students, teaching for teachers
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        
        // Try enrolled courses first
        let coursesResponse = await fetch(`${apiUrl}/api/courses/public/enrolled/${userId}`);
        let coursesData = [];
        
        if (coursesResponse.ok) {
          coursesData = await coursesResponse.json();
        }
        
        // If no enrolled courses, try teaching courses (for teachers)
        if (coursesData.length === 0) {
          coursesResponse = await fetch(`${apiUrl}/api/courses/public/teaching/${userId}`);
          if (coursesResponse.ok) {
            coursesData = await coursesResponse.json();
          }
        }
        
        if (coursesData.length > 0) {
          // Transform courses data to match our interface
          const transformedCourses = await Promise.all(coursesData.map(async (course: any) => {
            const progress = await getRealCourseProgress(course, userId);
            return {
              id: course._id,
              title: course.title,
              description: course.description || 'Descripción del curso',
              progress: progress,
              instructor: course.teacher?.name || 'Instructor',
              status: course.isActive ? 'active' : 'paused'
            };
          }));
          
          setMyCourses(transformedCourses);
        } else {
          // Fallback to demo data
          setMyCourses([
            { id: '1', title: 'JavaScript Avanzado', description: 'Domina los conceptos modernos de JavaScript', progress: 75, instructor: 'Prof. García', status: 'active' },
            { id: '2', title: 'Fundamentos de React', description: 'Aprende React desde cero', progress: 100, instructor: 'Dr. Martínez', status: 'completed' },
            { id: '3', title: 'Backend con Node.js', description: 'Construye aplicaciones backend escalables', progress: 40, instructor: 'Prof. López', status: 'active' },
            { id: '4', title: 'Diseño de Bases de Datos', description: 'Diseña bases de datos eficientes', progress: 0, instructor: 'Dr. Rodríguez', status: 'paused' },
          ]);
        }
      } catch (courseError) {
        console.error('Error loading courses:', courseError);
      }
    } catch (error) {
      console.error('Error loading community data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderLeaderboard = () => (
    <div className={styles.leaderboardContainer}>
      <h2 className={styles.sectionTitle}>🏆 Leaderboard</h2>
      <div className={styles.leaderboardList}>
        {leaderboard.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay datos de clasificación disponibles aún.</p>
            <p>¡Comienza a ganar puntos participando en clases y viendo videos!</p>
          </div>
        ) : (
          leaderboard.map((entry, index) => (
            <div 
              key={entry.userId} 
              className={`${styles.leaderboardItem} ${entry.userId === user?.id ? styles.currentUser : ''}`}
            >
              <div className={styles.rankBadge}>
                {entry.rank <= 3 ? (
                  <span className={styles.medal}>
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                  </span>
                ) : (
                  <span className={styles.rankNumber}>#{entry.rank}</span>
                )}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{entry.userName}</div>
                <div className={styles.userLevel}>Nivel {entry.level}</div>
              </div>
              <div className={styles.userStats}>
                <div className={styles.points}>{entry.points.toLocaleString()} pts</div>
                <div className={styles.streak}>{entry.streak} días seguidos</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderMyCourses = () => (
    <div className={styles.coursesContainer}>
      <h2 className={styles.sectionTitle}>📚 Mis Cursos</h2>
      <div className={styles.coursesList}>
        {myCourses.map((course) => (
          <div key={course.id} className={styles.courseCard}>
            <div className={styles.courseHeader}>
              <h3 className={styles.courseTitle}>{course.title}</h3>
              <span className={`${styles.courseStatus} ${styles[course.status]}`}>
                {course.status === 'active' ? 'En Progreso' : 
                 course.status === 'completed' ? 'Completado' : 'Pausado'}
              </span>
            </div>
            <p className={styles.courseDescription}>{course.description}</p>
            <div className={styles.courseFooter}>
              <div className={styles.courseInstructor}>👨‍🏫 {course.instructor}</div>
              <div className={styles.courseProgress}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
                <span className={styles.progressText}>{course.progress}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFriends = () => (
    <div className={styles.friendsContainer}>
      <h2 className={styles.sectionTitle}>👥 Compañeros de Estudio</h2>
      <div className={styles.friendsList}>
        {friends.map((friend) => (
          <div key={friend.id} className={styles.friendCard}>
            <div className={styles.friendAvatar}>
              <span className={styles.avatarText}>
                {friend.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
              <div className={`${styles.statusIndicator} ${styles[friend.status]}`} />
            </div>
            <div className={styles.friendInfo}>
              <div className={styles.friendName}>{friend.name}</div>
              <div className={styles.friendLevel}>{friend.level}</div>
              <div className={styles.friendLastSeen}>
                {friend.status === 'online' ? 'En línea' : `Visto ${friend.lastSeen}`}
              </div>
            </div>
            <div className={styles.friendStats}>
              <div className={styles.friendPoints}>{friend.points.toLocaleString()} pts</div>
              <button className={styles.challengeButton}>Desafiar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading && !user) {
    return (
      <Layout title="Comunidad">
        <div className={styles.container}>
          <div className={styles.loading}>Cargando comunidad...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Comunidad">
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Comunidad</h1>
          <p className={styles.subtitle}>Conecta, compite y aprende junto a otros estudiantes</p>
        </div>

        {/* Tab Selector */}
        <div className={styles.tabSelector}>
          <button
            className={`${styles.tab} ${activeTab === 'leaderboard' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('leaderboard')}
          >
            Clasificación
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'courses' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('courses')}
          >
            Mis Cursos
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === 'leaderboard' && renderLeaderboard()}
          {activeTab === 'courses' && renderMyCourses()}
        </div>
      </div>
    </Layout>
  );
} 