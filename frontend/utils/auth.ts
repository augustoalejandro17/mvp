import Cookies from 'js-cookie';
import axios from 'axios';

/**
 * Verifica un token JWT con el backend y devuelve la información del usuario
 * @param token El token JWT a verificar
 * @returns La información del usuario si el token es válido, null en caso contrario
 */
export const verifyToken = async (token: string) => {
  try {
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
    return null;
  }
};

/**
 * Obtiene el token JWT almacenado en las cookies
 * @returns El token JWT o null si no existe
 */
export const getToken = () => {
  return Cookies.get('token') || null;
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
  router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
}; 