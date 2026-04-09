import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { getToken, clearAuth } from './auth';

const normalizeApiBaseUrl = (rawValue?: string): string => {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) {
    return '/api';
  }

  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const baseURL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);

console.log('API Base URL:', baseURL); // Para debugging

// Create an Axios instance with default config
const api = axios.create({
  baseURL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add utility function for refreshing image URLs
const refreshImageUrl = async (key: string): Promise<string | null> => {
  try {
    const response = await api.get('/images/refresh-url', {
      params: { key }
    });
    
    if (response.data && response.data.url) {
      return response.data.url;
    }
    return null;
  } catch (error) {
    console.error('Error refreshing image URL:', error);
    return null;
  }
};

// Request interceptor to add auth token to all requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken(); // Usar getToken que verifica expiración

    if (typeof config.url === 'string' && config.url.startsWith('/api/')) {
      config.url = config.url.replace(/^\/api/, '');
    }
    
    // Only add token if it exists, is valid, AND the request doesn't explicitly exclude it
    if (token && config.headers && !config.headers['Skip-Auth']) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Clean up the Skip-Auth header if it exists
    if (config.headers) {
      delete config.headers['Skip-Auth'];
    }
    
    return config;
  },
  (error: unknown) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: unknown) => {
    // Handle specific error cases
    if (axios.isAxiosError(error) && error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      if (error.response.status === 401) {
        // Get the request URL to check if it's a public resource
        const requestUrl = error.config?.url || '';
        
        // Skip auto-redirect for public course API calls and video streaming
        // More precise URL matching to handle query parameters
        const isPublicCourseCall = (
          requestUrl.includes('/api/courses/') || 
          requestUrl.includes('/courses/') ||
          (requestUrl.includes('/api/courses') && !requestUrl.includes('/enrollment') && !requestUrl.includes('/payments'))
        ) && !requestUrl.includes('/enrollment') && !requestUrl.includes('/payments');
        
        const isVideoStreamCall = (
          requestUrl.includes('/stream-url') || 
          requestUrl.includes('/video-proxy') ||
          (requestUrl.includes('/api/classes/') && !requestUrl.includes('/enrollment') && !requestUrl.includes('/payments')) ||
          (requestUrl.includes('/classes/') && !requestUrl.includes('/enrollment') && !requestUrl.includes('/payments')) ||
          requestUrl.includes('/playlists') ||
          requestUrl.includes('/api/playlists') ||
          requestUrl.includes('/api/usage/')
        );
        
        if (!isPublicCourseCall && !isVideoStreamCall) {
          // Unauthorized - Clear token and redirect to home
          clearAuth();
          
          // Solo redirigir si no estamos ya en la página de login o home
          const currentPath = window.location.pathname;
          if (!currentPath.includes('/login') && currentPath !== '/') {
            window.location.href = '/';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

// Add the refreshImageUrl function to the api instance
(api as any).refreshImageUrl = refreshImageUrl;

export default api; 
