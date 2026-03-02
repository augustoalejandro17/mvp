import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  ICourse,
  IClass,
  ISchool,
  IUser,
  LoginDto,
  LoginResponse,
} from '@inti/shared-types';

export interface CourseProgressSummary {
  courseId: string;
  totalClasses: number;
  completedClasses: number;
  completionPercentage: number;
  totalVideoMinutes: number;
  watchedVideoMinutes: number;
  attendedClasses: number;
  isCompleted: boolean;
  completedAt?: string;
  lastActivityAt: string;
  streak: number;
  longestStreak: number;
  averageVideoWatchPercentage: number;
}

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedNotifications {
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
  currentPage: number;
  totalPages: number;
}

export type ReportContentType = 'class' | 'course' | 'school';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'misinformation'
  | 'copyright'
  | 'other';

export interface CreateContentReportPayload {
  contentType: ReportContentType;
  contentId: string;
  reason: ReportReason;
  contentTitle?: string;
  details?: string;
}

export type ReportStatus =
  | 'pending'
  | 'under_review'
  | 'action_taken'
  | 'dismissed';

export interface ContentReport {
  _id: string;
  contentType: ReportContentType;
  contentId: string;
  contentTitle?: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt?: string;
  moderatorNotes?: string;
  reporter?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  reviewedBy?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

export type UserReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'impersonation'
  | 'scam'
  | 'other';

export interface CreateUserReportPayload {
  reportedUserId: string;
  reason: UserReportReason;
  details?: string;
}

export interface UserReport {
  _id: string;
  reason: UserReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt?: string;
  moderatorNotes?: string;
  reporter?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  reportedUser?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  reviewedBy?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
} as const;

type OnUnauthorizedCallback = () => void;

const DEFAULT_PROD_API_URL = 'https://api.intihubs.com/api';

const normalizeApiUrl = (url: string): string => {
  const trimmed = url.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const getBaseURL = () => {
  const fromExtra =
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
    ((Constants as any).manifest?.extra?.apiUrl as string | undefined) ||
    ((Constants as any).expoGoConfig?.extra?.apiUrl as string | undefined);
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;

  if (__DEV__) {
    if (fromEnv) {
      return normalizeApiUrl(fromEnv);
    }

    // Try LAN host from Expo first (useful on physical devices).
    const hostUri =
      (Constants.expoConfig as any)?.hostUri ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).expoGoConfig?.debuggerHost;

    if (hostUri) {
      const host = String(hostUri).split(':')[0];
      if (host && host !== '127.0.0.1' && host !== 'localhost') {
        return `http://${host}:4000/api`;
      }
    }

    // If project config provides an API URL, prefer it before localhost fallbacks.
    if (fromExtra) {
      return normalizeApiUrl(fromExtra);
    }

    // Simulator/emulator defaults.
    if (Platform.OS === 'ios') {
      return 'http://127.0.0.1:4000/api';
    }
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:4000/api';
    }
  }

  if (fromEnv) {
    return normalizeApiUrl(fromEnv);
  }

  if (fromExtra) {
    return normalizeApiUrl(fromExtra);
  }

  return DEFAULT_PROD_API_URL;
};

const BASE_URL = getBaseURL();
export const API_BASE_URL = BASE_URL;

class ApiClient {
  private client: AxiosInstance;
  private onUnauthorized: OnUnauthorizedCallback | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          await this.clearAuth();
          this.onUnauthorized?.();
        }
        return Promise.reject(error);
      }
    );
  }

  setOnUnauthorized(callback: OnUnauthorizedCallback) {
    this.onUnauthorized = callback;
  }

  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  async clearAuth(): Promise<void> {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
  }

  async login(credentials: LoginDto): Promise<LoginResponse> {
    const { data } = await this.client.post<LoginResponse>('/auth/login', credentials);
    if (data.token) {
      await this.setToken(data.token);
    }
    return data;
  }

  async logout(): Promise<void> {
    await this.clearAuth();
  }

  async deleteMyAccount(): Promise<void> {
    await this.client.delete('/users/me');
    await this.clearAuth();
  }

  async getCurrentUser(): Promise<IUser> {
    const { data } = await this.client.get<IUser>('/auth/profile');
    return data;
  }

  async createContentReport(
    payload: CreateContentReportPayload
  ): Promise<{ success: boolean; message: string; report: ContentReport }> {
    const { data } = await this.client.post('/content-reports', payload);
    return data;
  }

  async getMyContentReports(
    page = 1,
    limit = 20
  ): Promise<{ reports: ContentReport[]; total: number; currentPage: number; totalPages: number }> {
    const { data } = await this.client.get('/content-reports/mine', {
      params: { page, limit },
    });
    return data;
  }

  async getContentReports(
    params: { status?: ReportStatus; contentType?: ReportContentType; page?: number; limit?: number } = {}
  ): Promise<{ reports: ContentReport[]; total: number; currentPage: number; totalPages: number }> {
    const { data } = await this.client.get('/content-reports', { params });
    return data;
  }

  async updateContentReportStatus(
    reportId: string,
    status: ReportStatus,
    moderatorNotes?: string
  ): Promise<{ success: boolean; message: string; report: ContentReport }> {
    const { data } = await this.client.patch(`/content-reports/${reportId}/status`, {
      status,
      moderatorNotes,
    });
    return data;
  }

  async createUserReport(
    payload: CreateUserReportPayload
  ): Promise<{ success: boolean; message: string; report: UserReport }> {
    const { data } = await this.client.post('/user-reports', payload);
    return data;
  }

  async getMyUserReports(
    page = 1,
    limit = 20
  ): Promise<{ reports: UserReport[]; total: number; currentPage: number; totalPages: number }> {
    const { data } = await this.client.get('/user-reports/mine', {
      params: { page, limit },
    });
    return data;
  }

  async getUserReports(
    params: { status?: ReportStatus; page?: number; limit?: number } = {}
  ): Promise<{ reports: UserReport[]; total: number; currentPage: number; totalPages: number }> {
    const { data } = await this.client.get('/user-reports', { params });
    return data;
  }

  async updateUserReportStatus(
    reportId: string,
    status: ReportStatus,
    moderatorNotes?: string
  ): Promise<{ success: boolean; message: string; report: UserReport }> {
    const { data } = await this.client.patch(`/user-reports/${reportId}/status`, {
      status,
      moderatorNotes,
    });
    return data;
  }

  async getPublicSchools(): Promise<ISchool[]> {
    const { data } = await this.client.get<ISchool[]>('/schools/public');
    return data;
  }

  async getCourses(): Promise<ICourse[]> {
    const { data } = await this.client.get<ICourse[]>('/courses');
    return data;
  }

  async getEnrolledCourses(): Promise<ICourse[]> {
    const { data } = await this.client.get<ICourse[]>('/courses/enrolled');
    return data;
  }

  async getCoursesBySchool(schoolId: string): Promise<ICourse[]> {
    const { data } = await this.client.get<ICourse[]>('/courses', {
      params: { schoolId },
    });
    return data;
  }

  async getCourseById(id: string): Promise<ICourse> {
    const { data } = await this.client.get<ICourse>(`/courses/${id}`);
    return data;
  }

  async getClassesByCourse(courseId: string): Promise<IClass[]> {
    const { data } = await this.client.get<IClass[]>('/classes', {
      params: { courseId },
    });
    return data;
  }

  async getClassById(id: string): Promise<IClass> {
    const { data } = await this.client.get<IClass>(`/classes/${id}`);
    return data;
  }

  async getStreamUrl(classId: string): Promise<{ success: boolean; url?: string; title?: string; metadata?: any; message?: string }> {
    const { data } = await this.client.get(`/classes/${classId}/stream-url`, {
      params: { direct: true },
    });
    return data;
  }

  async getUserCoursesProgress(userId: string): Promise<CourseProgressSummary[]> {
    const { data } = await this.client.get<CourseProgressSummary[]>(
      `/progress/user/${userId}/courses`
    );
    return data;
  }

  async getNotifications(page = 1, limit = 20): Promise<PaginatedNotifications> {
    const { data } = await this.client.get<PaginatedNotifications>('/notifications', {
      params: { page, limit },
    });
    return data;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.client.put(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.client.put('/notifications/mark-all-read');
  }

  // ─── Playlists ────────────────────────────────────────────────────────────
  async getPlaylists(courseId: string): Promise<any[]> {
    const { data } = await this.client.get('/playlists', { params: { courseId } });
    return data;
  }

  async getPlaylistById(playlistId: string): Promise<any> {
    const { data } = await this.client.get(`/playlists/${playlistId}`);
    return data;
  }

  async getUnorganizedClasses(courseId: string): Promise<IClass[]> {
    const { data } = await this.client.get<IClass[]>('/playlists/unorganized', { params: { courseId } });
    return data;
  }

  async createPlaylist(dto: { name: string; description?: string; course: string; isPublic?: boolean }): Promise<any> {
    const { data } = await this.client.post('/playlists', dto);
    return data;
  }

  async updatePlaylist(id: string, dto: { name?: string; description?: string; isPublic?: boolean }): Promise<any> {
    const { data } = await this.client.patch(`/playlists/${id}`, dto);
    return data;
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.client.delete(`/playlists/${id}`);
  }

  async addClassToPlaylist(playlistId: string, classId: string): Promise<any> {
    const { data } = await this.client.post(`/playlists/${playlistId}/add-class`, { classId });
    return data;
  }

  async removeClassFromPlaylist(playlistId: string, classId: string): Promise<any> {
    const { data } = await this.client.post(`/playlists/${playlistId}/remove-class`, { classId });
    return data;
  }

  async reorderClassesInPlaylist(playlistId: string, classIds: string[]): Promise<any> {
    const { data } = await this.client.post(`/playlists/${playlistId}/reorder`, { classIds });
    return data;
  }

  async reorderPlaylistsInCourse(courseId: string, playlistIds: string[]): Promise<void> {
    await this.client.post('/playlists/reorder-course', { courseId, playlistIds });
  }

  // ─── Admin: Classes ───────────────────────────────────────────────────────

  async createClass(dto: { title: string; description: string; courseId: string; order?: number; isPublic?: boolean }): Promise<IClass> {
    const { data } = await this.client.post<IClass>('/classes', dto);
    return data;
  }

  async updateClass(id: string, dto: Partial<{ title: string; description: string; order: number; isPublic: boolean }>): Promise<IClass> {
    const { data } = await this.client.put<IClass>(`/classes/${id}`, dto);
    return data;
  }

  async deleteClass(id: string): Promise<void> {
    await this.client.delete(`/classes/${id}`);
  }

  // ─── Admin: Schools ───────────────────────────────────────────────────────
  async createSchool(dto: { name: string; description: string; address?: string; phone?: string; website?: string; isPublic?: boolean }): Promise<ISchool> {
    const { data } = await this.client.post<ISchool>('/schools', dto);
    return data;
  }

  async updateSchool(id: string, dto: Partial<{ name: string; description: string; address: string; phone: string; website: string; isPublic: boolean }>): Promise<ISchool> {
    const { data } = await this.client.put<ISchool>(`/schools/${id}`, dto);
    return data;
  }

  async deleteSchool(id: string): Promise<void> {
    await this.client.delete(`/schools/${id}`);
  }

  async getSchoolById(id: string): Promise<ISchool> {
    const { data } = await this.client.get<ISchool>(`/schools/${id}`);
    return data;
  }

  async getAllSchools(): Promise<ISchool[]> {
    const { data } = await this.client.get<ISchool[]>('/schools');
    return data;
  }

  // ─── Admin: Courses ───────────────────────────────────────────────────────
  async createCourse(dto: { title: string; description: string; schoolId: string; isPublic?: boolean }): Promise<ICourse> {
    const { data } = await this.client.post<ICourse>('/courses', dto);
    return data;
  }

  async updateCourse(id: string, dto: Partial<{ title: string; description: string; isPublic: boolean; isActive: boolean; isFeatured: boolean }>): Promise<ICourse> {
    const { data } = await this.client.put<ICourse>(`/courses/${id}`, dto);
    return data;
  }

  async deleteCourse(id: string): Promise<void> {
    await this.client.delete(`/courses/${id}`);
  }

  // ─── Admin: Users ─────────────────────────────────────────────────────────
  async getUsers(): Promise<IUser[]> {
    const { data } = await this.client.get<IUser[]>('/users');
    return data;
  }

  async updateUserRole(userId: string, role: string): Promise<IUser> {
    const { data } = await this.client.patch<IUser>(`/auth/users/${userId}/role`, { role });
    return data;
  }

  // ─── Admin: Stats ─────────────────────────────────────────────────────────
  async getAdminStats(): Promise<{
    totalUsers?: number;
    totalStudents?: number;
    totalTeachers?: number;
    totalSchools?: number;
    totalCourses?: number;
    totalClasses?: number;
    activeUsers?: number;
    [key: string]: any;
  }> {
    try {
      const { data } = await this.client.get('/statistics/overview');
      return data;
    } catch {
      return {};
    }
  }

  getBaseURL(): string {
    return BASE_URL;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
