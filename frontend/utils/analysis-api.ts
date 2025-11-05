import axios from 'axios';
import { AnalysisInput, AnalysisResponse, AnalysisListItem } from '../types/bachata-analysis';

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

export const analysisApi = {
  // Create new analysis from landmarks
  createAnalysis: async (analysisInput: AnalysisInput): Promise<AnalysisResponse> => {
    const response = await apiClient.post('/analysis/landmarks', analysisInput);
    return response.data;
  },

  // Get specific analysis by ID
  getAnalysis: async (analysisId: string): Promise<AnalysisResponse> => {
    const response = await apiClient.get(`/analysis/${analysisId}`);
    return response.data;
  },

  // Get user's analysis history
  getUserAnalyses: async (page: number = 1, limit: number = 10): Promise<{
    analyses: AnalysisListItem[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const response = await apiClient.get('/analysis', {
      params: { page, limit },
    });
    return response.data;
  },

  // Get analysis statistics
  getAnalysisStats: async (): Promise<{
    totalAnalyses: number;
    averageScore: number;
    bestScore: number;
    recentTrend: 'improving' | 'declining' | 'stable';
  }> => {
    const response = await apiClient.get('/analysis/stats/summary');
    return response.data;
  },
};

export default analysisApi;
