import Cookies from 'js-cookie';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
  exp: number;
}

// Global axios interceptor to handle 401 errors from any axios instance
let isInterceptorAdded = false;

const addGlobalAxiosInterceptor = () => {
  if (isInterceptorAdded) return;
  
  // Add global request interceptor to add JWT token
  axios.interceptors.request.use(
    (config) => {
      const token = Cookies.get('token');
      if (token && !isTokenExpired(token)) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  
  // Add global response interceptor to handle 401 errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.log('Global interceptor: 401 error detected, clearing auth and redirecting to home');
        clearAuth();
        
        // Only redirect if we're not already on home or login
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (currentPath !== '/' && !currentPath.includes('/login')) {
            window.location.href = '/';
          }
        }
      }
      return Promise.reject(error);
    }
  );
  
  isInterceptorAdded = true;
};

// Initialize global interceptor
if (typeof window !== 'undefined') {
  addGlobalAxiosInterceptor();
}

// Event emitter para cambios en la autenticación
const authListeners = new Set<() => void>();

export const subscribeToAuth = (listener: () => void) => {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
};

const notifyAuthChange = () => {
  // Crear una copia del Set para evitar modificaciones durante la iteración
  const listeners = new Set(authListeners);
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('Error en auth listener:', error);
    }
  });
};

/**
 * Verifica si un token JWT ha expirado
 * @param token El token JWT a verificar
 * @returns true si el token ha expirado, false en caso contrario
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<DecodedToken>(token);
    if (!decoded.exp) return true;
    
    // exp está en segundos, Date.now() en milisegundos
    return decoded.exp * 1000 < Date.now();
  } catch (error) {
    console.error('Error al decodificar token:', error);
    return true;
  }
};

/**
 * Verifica un token JWT con el backend y devuelve la información del usuario
 * @param token El token JWT a verificar
 * @returns La información del usuario si el token es válido, null en caso contrario
 */
export const verifyToken = async (token: string) => {
  try {
    if (isTokenExpired(token)) {
      clearAuth();
      return null;
    }

    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/verify`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error al verificar token:', error);
    clearAuth();
    return null;
  }
};

/**
 * Obtiene el token JWT almacenado en las cookies y verifica que no haya expirado
 * @returns El token JWT o null si no existe o ha expirado
 */
export const getToken = () => {
  const token = Cookies.get('token');
  if (!token || isTokenExpired(token)) {
    clearAuth();
    return null;
  }
  return token;
};

/**
 * Limpia la autenticación (elimina el token y notifica a los listeners)
 */
export const clearAuth = () => {
  // Primero eliminar el token para evitar ciclos
  const hadToken = !!Cookies.get('token');
  Cookies.remove('token');
  Cookies.remove('user');
  
  // Solo notificar si había un token
  if (hadToken) {
    notifyAuthChange();
  }
};

/**
 * Fuerza una actualización del estado de autenticación
 */
export const refreshAuth = () => {
  notifyAuthChange();
};

/**
 * Comprueba si un usuario tiene un rol específico
 * @param user El usuario a comprobar
 * @param roles Array de roles permitidos
 * @returns true si el usuario tiene alguno de los roles especificados, false en caso contrario
 */
export const hasRole = (user: any, roles: string[]) => {
  if (!user || !user.role) return false;
  return roles.includes(user.role);
};

/**
 * Redirecciona a la página de login si no hay un token válido
 * @param router El router de Next.js
 * @param redirectPath La ruta a la que redirigir después del login
 */
export const redirectToLogin = (router: any, redirectPath: string) => {
  clearAuth();
  router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
};

/**
 * Cierra sesión del usuario de manera segura, invalidando la sesión en el servidor
 */
export const logout = async () => {
  try {
    const token = Cookies.get('token');
    if (token) {
      // Call backend logout endpoint to invalidate session
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }
  } catch (error) {
    console.error('Error al cerrar sesión en el servidor:', error);
    // Continue with local logout even if server call fails
  } finally {
    // Always clear local auth data
    clearAuth();
  }
}; 