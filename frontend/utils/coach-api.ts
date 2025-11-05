import axios from 'axios';
import { 
  CreateDrillInput,
  DrillDTO,
  DrillListItem,
  AttemptInput,
  AttemptResult,
  AttemptListItem,
  DrillWeights,
  DrillPhase
} from '../types/bachata-analysis';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export const coachApi = {
  // Drill management (Teacher)
  createDrill: async (drillInput: CreateDrillInput): Promise<DrillDTO> => {
    const response = await apiClient.post('/coach/drills', drillInput);
    return response.data;
  },

  updateDrill: async (
    drillId: string, 
    updates: {
      title?: string;
      bpm?: number;
      weights?: DrillWeights;
      hints?: string[];
      phases?: DrillPhase[];
    }
  ): Promise<DrillDTO> => {
    const response = await apiClient.patch(`/coach/drills/${drillId}`, updates);
    return response.data;
  },

  getTeacherDrills: async (page: number = 1, limit: number = 10): Promise<{
    drills: DrillListItem[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const response = await apiClient.get('/coach/drills', {
      params: { page, limit },
    });
    return response.data;
  },

  getDrill: async (drillId: string): Promise<DrillDTO> => {
    const response = await apiClient.get(`/coach/drills/${drillId}`);
    return response.data;
  },

  // Attempt management (Student)
  createAttempt: async (drillId: string, attemptInput: AttemptInput): Promise<AttemptResult> => {
    const response = await apiClient.post(`/coach/drills/${drillId}/attempts`, attemptInput);
    return response.data;
  },

  getDrillAttempts: async (
    drillId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{
    attempts: AttemptListItem[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const response = await apiClient.get(`/coach/drills/${drillId}/attempts`, {
      params: { page, limit },
    });
    return response.data;
  },

  getAttempt: async (attemptId: string): Promise<AttemptResult> => {
    const response = await apiClient.get(`/coach/attempts/${attemptId}`);
    return response.data;
  },
};

export default coachApi;
