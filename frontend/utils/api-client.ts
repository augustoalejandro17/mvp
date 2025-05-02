import axios from 'axios';
import Cookies from 'js-cookie';

// Create an Axios instance with default config
const api = axios.create({
  baseURL: '/api', // Base URL for API endpoints
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token to all requests
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle specific error cases
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      if (error.response.status === 401) {
        // Unauthorized - Clear token and redirect to login
        Cookies.remove('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Add utility function for refreshing image URLs
api.refreshImageUrl = async (key: string): Promise<string | null> => {
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

export default api; 