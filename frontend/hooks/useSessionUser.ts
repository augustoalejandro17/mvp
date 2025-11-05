import { useState, useEffect } from 'react';

interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Mock user for development - replace with actual auth logic
const MOCK_USER: SessionUser = {
  id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  name: 'Test User',
  role: 'student',
};

export const useSessionUser = () => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      // In development, always return mock user
      if (process.env.NODE_ENV === 'development') {
        setUser(MOCK_USER);
      } else {
        // In production, implement actual auth check
        // This could integrate with your existing auth system
        const token = localStorage.getItem('token');
        if (token) {
          // Decode token or make API call to get user info
          setUser(MOCK_USER); // Replace with actual user data
        }
      }
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const login = (token: string) => {
    localStorage.setItem('token', token);
    setUser(MOCK_USER); // Replace with actual user data
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
};
