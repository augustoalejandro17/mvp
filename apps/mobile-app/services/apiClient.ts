import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  ICourse,
  IClass,
  ISchool,
  IUser,
  RegisterDto,
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

export interface UpdateMyProfilePayload {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
  bio?: string;
  profileImageUrl?: string;
}

export interface ChangeMyPasswordPayload {
  currentPassword?: string;
  newPassword?: string;
  password?: string;
}

export interface NativeUploadFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export interface CreatorTermsStatus {
  accepted: boolean;
  acceptedAt?: string;
  acceptedVersion?: string;
  requiredVersion: string;
}

export interface SeatPolicyCapabilities {
  canViewSeatManagementModule: boolean;
  canOpenEnrollFlow: boolean;
  canAssignCourseSeatPermit: boolean;
  canSetOwnerQuota: boolean;
  canReadOwnerQuota: boolean;
  canSetOwnerQuotaForTarget: boolean;
  canReadOwnerQuotaForTarget: boolean;
  canEnrollStudentInCourse: boolean;
  canUnenrollStudentFromCourse: boolean;
  canAddStudentToCourse: boolean;
  canRemoveStudentFromCourse: boolean;
}

export interface SeatPolicyResponse {
  userId: string;
  role: string;
  context: {
    schoolId: string | null;
    courseId: string | null;
    ownerId: string | null;
  };
  capabilities: SeatPolicyCapabilities;
}

export interface OwnerSeatQuota {
  ownerId: string;
  schoolId: string;
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
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

const buildApiErrorMessage = (
  data: any,
  fallback: string,
): string => {
  if (typeof data === 'string' && data.trim().length > 0) {
    return data;
  }

  const rawMessage = data?.message;
  if (Array.isArray(rawMessage)) {
    return rawMessage.join('\n');
  }
  if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
    return rawMessage;
  }
  if (typeof data?.error === 'string' && data.error.trim().length > 0) {
    return data.error;
  }
  return fallback;
};

const isValidLocalFileUri = (uri: string): boolean =>
  typeof uri === 'string' &&
  (uri.startsWith('file://') || uri.startsWith('content://'));

const MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024;

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
  ogv: 'video/ogg',
  m4v: 'video/x-m4v',
};

const getFileExtension = (fileName: string): string => {
  const parts = String(fileName || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
};

const normalizeUploadImageName = (fileName: string | undefined): string => {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  if (!raw) {
    return `image-${Date.now()}.jpg`;
  }
  return raw;
};

const normalizeUploadVideoName = (fileName: string | undefined): string => {
  const raw = typeof fileName === 'string' ? fileName.trim() : '';
  if (!raw) {
    return `video-${Date.now()}.mp4`;
  }
  return raw;
};

const normalizeUploadVideoMimeType = (
  fileName: string,
  mimeType: string | undefined,
): string => {
  if (
    typeof mimeType === 'string' &&
    mimeType.toLowerCase().startsWith('video/')
  ) {
    return mimeType.toLowerCase().split(';')[0].trim();
  }
  const ext = getFileExtension(fileName);
  return VIDEO_MIME_BY_EXT[ext] || 'video/mp4';
};

const parseResponseBody = async (response: Response): Promise<any> => {
  const text = await response.text().catch(() => '');
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

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

  async register(payload: RegisterDto): Promise<LoginResponse> {
    const { data } = await this.client.post<LoginResponse>('/auth/register', payload);
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

  async updateMyProfile(payload: UpdateMyProfilePayload): Promise<any> {
    const { data } = await this.client.put('/auth/onboarding/profile', payload);
    return data?.data ?? data;
  }

  async changeMyPassword(
    userId: string,
    payload: ChangeMyPasswordPayload
  ): Promise<void> {
    await this.client.patch(`/users/${userId}/password`, payload);
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

  async getEnrolledCoursesByUser(userId: string): Promise<ICourse[]> {
    const { data } = await this.client.get<ICourse[]>('/courses/enrolled', {
      params: { userId },
    });
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

  async markClassCompleted(classId: string): Promise<void> {
    await this.client.post(`/progress/class/${classId}/complete`);
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

  async createClassWithVideo(
    dto: {
      title: string;
      description: string;
      courseId: string;
      order?: number;
      isPublic?: boolean;
    },
    video: NativeUploadFile,
  ): Promise<IClass> {
    if (!video?.uri || !isValidLocalFileUri(video.uri)) {
      throw new Error('Archivo de video inválido. No se pudo resolver la ruta local.');
    }
    if (
      typeof video.size === 'number' &&
      video.size > MAX_VIDEO_UPLOAD_SIZE_BYTES
    ) {
      throw new Error('El video supera el límite permitido de 200MB.');
    }
    const safeVideoName = normalizeUploadVideoName(video.name);
    const safeVideoMimeType = normalizeUploadVideoMimeType(
      safeVideoName,
      video.type,
    );

    const formData = new FormData();
    formData.append('title', dto.title);
    formData.append('description', dto.description);
    formData.append('courseId', dto.courseId);
    if (dto.order != null) {
      formData.append('order', String(dto.order));
    }
    if (dto.isPublic != null) {
      formData.append('isPublic', String(dto.isPublic));
    }
    formData.append('video', {
      uri: video.uri,
      name: safeVideoName,
      type: safeVideoMimeType,
    } as any);
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    const response = await fetch(`${BASE_URL}/classes`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await parseResponseBody(response);
    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('El video supera el límite permitido de 200MB.');
      }
      throw new Error(buildApiErrorMessage(data, 'No se pudo crear la clase con video'));
    }
    return data as IClass;
  }

  async updateClass(id: string, dto: Partial<{ title: string; description: string; order: number; isPublic: boolean }>): Promise<IClass> {
    const { data } = await this.client.put<IClass>(`/classes/${id}`, dto);
    return data;
  }

  async updateClassWithVideo(
    id: string,
    dto: Partial<{
      title: string;
      description: string;
      courseId: string;
      order: number;
      isPublic: boolean;
    }>,
    video: NativeUploadFile,
  ): Promise<IClass> {
    if (!video?.uri || !isValidLocalFileUri(video.uri)) {
      throw new Error('Archivo de video inválido. No se pudo resolver la ruta local.');
    }
    if (
      typeof video.size === 'number' &&
      video.size > MAX_VIDEO_UPLOAD_SIZE_BYTES
    ) {
      throw new Error('El video supera el límite permitido de 200MB.');
    }
    const safeVideoName = normalizeUploadVideoName(video.name);
    const safeVideoMimeType = normalizeUploadVideoMimeType(
      safeVideoName,
      video.type,
    );

    const formData = new FormData();
    if (dto.title != null) {
      formData.append('title', dto.title);
    }
    if (dto.description != null) {
      formData.append('description', dto.description);
    }
    if (dto.courseId != null) {
      formData.append('courseId', dto.courseId);
    }
    if (dto.order != null) {
      formData.append('order', String(dto.order));
    }
    if (dto.isPublic != null) {
      formData.append('isPublic', String(dto.isPublic));
    }
    formData.append('video', {
      uri: video.uri,
      name: safeVideoName,
      type: safeVideoMimeType,
    } as any);
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    const response = await fetch(`${BASE_URL}/classes/${id}`, {
      method: 'PUT',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await parseResponseBody(response);
    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('El video supera el límite permitido de 200MB.');
      }
      throw new Error(buildApiErrorMessage(data, 'No se pudo actualizar la clase con video'));
    }
    return data as IClass;
  }

  async deleteClass(id: string): Promise<void> {
    await this.client.delete(`/classes/${id}`);
  }

  // ─── Admin: Schools ───────────────────────────────────────────────────────
  async createSchool(dto: {
    name: string;
    description: string;
    logoUrl?: string;
    address?: string;
    phone?: string;
    website?: string;
    isPublic?: boolean;
  }): Promise<ISchool> {
    const { data } = await this.client.post<ISchool>('/schools', dto);
    return data;
  }

  async updateSchool(
    id: string,
    dto: Partial<{
      name: string;
      description: string;
      logoUrl: string;
      address: string;
      phone: string;
      website: string;
      isPublic: boolean;
    }>,
  ): Promise<ISchool> {
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
  async createCourse(dto: {
    title: string;
    description: string;
    schoolId: string;
    coverImageUrl?: string;
    teacher?: string;
    isPublic?: boolean;
  }): Promise<ICourse> {
    const { data } = await this.client.post<ICourse>('/courses', dto);
    return data;
  }

  async updateCourse(
    id: string,
    dto: Partial<{
      title: string;
      description: string;
      coverImageUrl: string;
      isPublic: boolean;
      isActive: boolean;
      isFeatured: boolean;
    }>,
  ): Promise<ICourse> {
    try {
      const { data } = await this.client.put<ICourse>(`/courses/${id}`, dto);
      return data;
    } catch (error: any) {
      const message = buildApiErrorMessage(
        error?.response?.data,
        error?.message || 'No se pudo actualizar el curso',
      );

      // Backward compatibility for older API deployments that still reject isActive in update payload.
      if (
        dto &&
        Object.prototype.hasOwnProperty.call(dto, 'isActive') &&
        message.toLowerCase().includes('isactive should not exist')
      ) {
        const fallbackDto = { ...dto } as any;
        delete fallbackDto.isActive;
        const { data } = await this.client.put<ICourse>(`/courses/${id}`, fallbackDto);
        return data;
      }

      throw error;
    }
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

  async updateUserStatus(
    userId: string,
    status: 'active' | 'inactive' | 'suspended',
    reason?: string,
  ): Promise<IUser> {
    const { data } = await this.client.patch<{ success: boolean; user: IUser }>(
      `/users/${userId}/status`,
      { status, reason },
    );
    return data.user;
  }

  async uploadImage(file: NativeUploadFile): Promise<string> {
    if (!file?.uri || !isValidLocalFileUri(file.uri)) {
      throw new Error('Archivo inválido. No se pudo resolver la ruta de la imagen.');
    }
    if (
      typeof file.size === 'number' &&
      file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES
    ) {
      throw new Error('La imagen supera el límite permitido de 5MB.');
    }

    const safeFileName = normalizeUploadImageName(file.name);
    const safeMimeType =
      typeof file.type === 'string' &&
      file.type.toLowerCase().startsWith('image/')
        ? file.type.toLowerCase().split(';')[0].trim()
        : 'image/jpeg';

    const formData = new FormData();
    formData.append('image', {
      uri: file.uri,
      name: safeFileName,
      type: safeMimeType,
    } as any);

    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    const response = await fetch(`${BASE_URL}/upload/image`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await parseResponseBody(response);
    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('La imagen supera el límite permitido de 5MB.');
      }
      throw new Error(buildApiErrorMessage(data, 'No se pudo subir la imagen'));
    }

    const imageUrl =
      typeof (data as any)?.imageUrl === 'string'
        ? (data as any).imageUrl
        : typeof (data as any)?.url === 'string'
          ? (data as any).url
          : '';

    if (!imageUrl) {
      throw new Error('La API no devolvió la URL de la imagen subida.');
    }

    return imageUrl;
  }

  async getCreatorTermsStatus(): Promise<CreatorTermsStatus> {
    const { data } = await this.client.get<CreatorTermsStatus>(
      '/auth/creator-terms/status',
    );
    return data;
  }

  async acceptCreatorTerms(version?: string): Promise<CreatorTermsStatus> {
    const { data } = await this.client.patch<CreatorTermsStatus>(
      '/auth/creator-terms/accept',
      version ? { version } : {},
    );
    return data;
  }

  async getSeatPolicy(params?: {
    schoolId?: string;
    courseId?: string;
    ownerId?: string;
  }): Promise<SeatPolicyResponse> {
    const { data } = await this.client.get<SeatPolicyResponse>(
      '/courses/seats/policy',
      { params },
    );
    return data;
  }

  async getOwnerSeatQuota(ownerId: string, schoolId: string): Promise<OwnerSeatQuota> {
    const { data } = await this.client.get<{ success: boolean; quota: OwnerSeatQuota }>(
      `/users/${ownerId}/owner-seat-quota`,
      { params: { schoolId } },
    );
    return data.quota;
  }

  async setOwnerSeatQuota(
    ownerId: string,
    schoolId: string,
    totalSeats: number,
  ): Promise<OwnerSeatQuota> {
    const { data } = await this.client.patch<{ success: boolean; quota: OwnerSeatQuota }>(
      `/users/${ownerId}/owner-seat-quota`,
      { schoolId, totalSeats },
    );
    return data.quota;
  }

  async assignCourseSeatPermit(
    userId: string,
    schoolId: string,
    courseId: string,
  ): Promise<void> {
    await this.client.post(`/users/${userId}/course-seats`, {
      schoolId,
      courseId,
    });
  }

  async enrollStudentInCourse(courseId: string, studentId: string): Promise<void> {
    await this.client.post(`/courses/${courseId}/enroll/${studentId}`, {});
  }

  async unenrollStudentFromCourse(
    courseId: string,
    studentId: string,
  ): Promise<void> {
    await this.client.post(`/courses/${courseId}/unenroll/${studentId}`, {});
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
