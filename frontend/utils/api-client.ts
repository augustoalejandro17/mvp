import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { getToken, clearAuth } from './auth';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
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
        // Unauthorized - Clear token and redirect to login
        clearAuth(); // Usar clearAuth para notificar a los componentes
        
        // Solo redirigir si no estamos ya en la página de login
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/login')) {
          const redirectPath = encodeURIComponent(currentPath);
          window.location.href = `/login?redirect=${redirectPath}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

// Add the refreshImageUrl function to the api instance
(api as any).refreshImageUrl = refreshImageUrl;

export default api; 