import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Helper function to make authenticated API calls
async function makeApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = Cookies.get('token');
    
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && {
          Authorization: `Bearer ${token}`,
        }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.message || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Badge API calls
export const badgeApi = {
  // Get all badges
  getAllBadges: async (includeInactive = false, type?: string) => {
    const params = new URLSearchParams();
    if (includeInactive) params.append('includeInactive', 'true');
    if (type) params.append('type', type);
    
    return makeApiCall(`/gamification/badges?${params}`);
  },

  // Get user badges
  getUserBadges: async (userId: string, schoolId: string, status?: string) => {
    const params = new URLSearchParams();
    params.append('schoolId', schoolId);
    if (status) params.append('status', status);
    
    return makeApiCall(`/gamification/badges/user/${userId}?${params}`);
  },

  // Get user badge stats
  getUserBadgeStats: async (userId: string, schoolId: string) => {
    return makeApiCall(`/gamification/badges/user/${userId}/stats?schoolId=${schoolId}`);
  },

  // Get badge progress
  getBadgeProgress: async (userId: string, badgeId: string, schoolId: string) => {
    return makeApiCall(`/gamification/badges/user/${userId}/progress/${badgeId}?schoolId=${schoolId}`);
  },

  // Get school badge leaderboard
  getSchoolBadgeLeaderboard: async (schoolId: string, limit = 10) => {
    return makeApiCall(`/gamification/badges/leaderboard/school/${schoolId}?limit=${limit}`);
  },

  // Award badge manually (teacher/admin only)
  awardBadge: async (userId: string, badgeId: string, schoolId: string, comment?: string) => {
    return makeApiCall('/gamification/badges/award', {
      method: 'POST',
      body: JSON.stringify({ userId, badgeId, schoolId, comment }),
    });
  },

  // Initialize user badge progress
  initializeBadgeProgress: async (userId: string, schoolId: string, courseId?: string) => {
    return makeApiCall('/gamification/badges/initialize', {
      method: 'POST',
      body: JSON.stringify({ userId, schoolId, courseId }),
    });
  },

  // Seed default badges (super admin only)
  seedDefaultBadges: async () => {
    return makeApiCall('/gamification/badges/seed', {
      method: 'POST',
    });
  },
};

// Points API calls
export const pointsApi = {
  // Get user points
  getUserPoints: async (userId: string, schoolId: string) => {
    return makeApiCall(`/gamification/points/user/${userId}?schoolId=${schoolId}`);
  },

  // Get user rank
  getUserRank: async (userId: string, schoolId: string) => {
    return makeApiCall(`/gamification/points/user/${userId}/rank?schoolId=${schoolId}`);
  },

  // Get top users
  getTopUsers: async (schoolId: string, limit = 10) => {
    return makeApiCall(`/gamification/points/top/school/${schoolId}?limit=${limit}`);
  },

  // Award points
  awardPoints: async (data: {
    userId: string;
    schoolId: string;
    points: number;
    actionType: string;
    description: string;
    courseId?: string;
    classId?: string;
    metadata?: Record<string, any>;
    sendNotification?: boolean;
  }) => {
    return makeApiCall('/gamification/points/award', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Deduct points
  deductPoints: async (data: {
    userId: string;
    schoolId: string;
    points: number;
    reason: string;
    metadata?: Record<string, any>;
  }) => {
    return makeApiCall('/gamification/points/deduct', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Update streak
  updateStreak: async (data: {
    userId: string;
    schoolId: string;
    streak?: number;
    resetStreak?: boolean;
  }) => {
    return makeApiCall('/gamification/points/streak', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Get user statistics
  getUserStats: async (userId: string, schoolId: string, period?: string) => {
    const params = new URLSearchParams();
    params.append('schoolId', schoolId);
    if (period) params.append('period', period);
    
    return makeApiCall(`/gamification/points/user/${userId}/stats?${params}`);
  },

  // Teacher reward points
  teacherRewardPoints: async (data: {
    userId: string;
    schoolId: string;
    points: number;
    reason: string;
    metadata?: Record<string, any>;
  }) => {
    return makeApiCall('/gamification/points/teacher-reward', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Leaderboard API calls
export const leaderboardApi = {
  // Get school leaderboard
  getSchoolLeaderboard: async (schoolId: string, period = 'all_time', limit = 10) => {
    return makeApiCall(`/gamification/leaderboard/school/${schoolId}?period=${period}&limit=${limit}`);
  },

  // Get global leaderboard
  getGlobalLeaderboard: async (period = 'all_time', limit = 10) => {
    return makeApiCall(`/gamification/leaderboard/global?period=${period}&limit=${limit}`);
  },

  // Get course leaderboard
  getCourseLeaderboard: async (courseId: string, period = 'all_time', limit = 10) => {
    return makeApiCall(`/gamification/leaderboard/course/${courseId}?period=${period}&limit=${limit}`);
  },

  // Get user position in leaderboard
  getUserPosition: async (userId: string, schoolId: string, period = 'all_time') => {
    return makeApiCall(`/gamification/leaderboard/user/${userId}/position?schoolId=${schoolId}&period=${period}`);
  },

  // Get surrounding users in leaderboard
  getSurroundingUsers: async (userId: string, schoolId: string, period = 'all_time', range = 5) => {
    return makeApiCall(`/gamification/leaderboard/user/${userId}/surrounding?schoolId=${schoolId}&period=${period}&range=${range}`);
  },
};

// Integration hooks - these can be called from existing components
export const gamificationHooks = {
  // Track video watching
  trackVideoWatch: async (userId: string, schoolId: string, videoId: string, duration: number, metadata?: Record<string, any>) => {
    return pointsApi.awardPoints({
      userId,
      schoolId,
      points: Math.floor(duration / 60) * 2, // 2 points per minute
      actionType: 'video_watch',
      description: `Watched video for ${Math.floor(duration / 60)} minutes`,
      metadata: { videoId, duration, ...metadata },
      sendNotification: true,
    });
  },

  // Track class attendance
  trackAttendance: async (userId: string, schoolId: string, classId: string, isOnTime: boolean, metadata?: Record<string, any>) => {
    const basePoints = 10;
    const bonusPoints = isOnTime ? 5 : 0;
    
    return pointsApi.awardPoints({
      userId,
      schoolId,
      points: basePoints + bonusPoints,
      actionType: 'class_attendance',
      description: `Attended class${isOnTime ? ' on time' : ''}`,
      classId,
      metadata: { isOnTime, ...metadata },
      sendNotification: true,
    });
  },

  // Track assignment completion
  trackAssignmentCompletion: async (userId: string, schoolId: string, assignmentId: string, score: number, metadata?: Record<string, any>) => {
    const basePoints = 15;
    const bonusPoints = score >= 90 ? 10 : score >= 80 ? 5 : 0;
    
    return pointsApi.awardPoints({
      userId,
      schoolId,
      points: basePoints + bonusPoints,
      actionType: 'assignment_completion',
      description: `Completed assignment with ${score}% score`,
      metadata: { assignmentId, score, ...metadata },
      sendNotification: true,
    });
  },

  // Track course completion
  trackCourseCompletion: async (userId: string, schoolId: string, courseId: string, metadata?: Record<string, any>) => {
    return pointsApi.awardPoints({
      userId,
      schoolId,
      points: 100,
      actionType: 'course_completion',
      description: 'Completed course',
      courseId,
      metadata,
      sendNotification: true,
    });
  },

  // Track participation
  trackParticipation: async (userId: string, schoolId: string, type: string, metadata?: Record<string, any>) => {
    const pointsMap: Record<string, number> = {
      question: 5,
      answer: 10,
      help_others: 15,
    };
    
    return pointsApi.awardPoints({
      userId,
      schoolId,
      points: pointsMap[type] || 5,
      actionType: 'participation',
      description: `Participated: ${type}`,
      metadata: { participationType: type, ...metadata },
      sendNotification: true,
    });
  },
};

// System health check
export const systemApi = {
  checkHealth: async () => {
    return makeApiCall('/health');
  },
};

// Export types for TypeScript
export type BadgeResponse = any; // Replace with actual badge type
export type PointsResponse = any; // Replace with actual points type
export type LeaderboardResponse = any; // Replace with actual leaderboard type 