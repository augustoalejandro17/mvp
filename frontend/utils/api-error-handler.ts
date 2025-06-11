import { useState, useCallback } from 'react';
import { AxiosError } from 'axios';

/**
 * Hook para manejar errores de API de forma consistente
 * @returns Función para manejar errores y state para el mensaje de error
 */
export const useApiErrorHandler = () => {
  const [error, setError] = useState<string | null>(null);

  const handleApiError = useCallback((err: unknown, customMessage?: string): string => {
    let errorMessage = customMessage || 'Ha ocurrido un error inesperado';

    if (err instanceof AxiosError) {
      // Extraer mensaje de error de la respuesta de axios
      if (err.response?.data?.message) {
        if (Array.isArray(err.response.data.message)) {
          errorMessage = err.response.data.message.join(', ');
        } else {
          errorMessage = err.response.data.message;
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.status === 401) {
        errorMessage = 'No autorizado. Por favor, inicia sesión nuevamente.';
        // Redirigir al home si es necesario
        if (typeof window !== 'undefined') {
          
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      } else if (err.response?.status === 403) {
        errorMessage = 'No tienes permisos para realizar esta acción.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Recurso no encontrado.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Error en el servidor. Por favor, intenta más tarde o contacta al administrador.';
        console.error('Error 500 del servidor:', err.response?.data || 'No hay detalles disponibles');
      }
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    setError(errorMessage);
    return errorMessage;
  }, []);

  return { handleApiError, error, setError };
}; 