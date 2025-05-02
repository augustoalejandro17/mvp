import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ImageFallbackProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

const ImageFallback: React.FC<ImageFallbackProps> = ({
  src,
  alt,
  className = '',
  placeholderClassName = '',
}) => {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [fallbackActive, setFallbackActive] = useState<boolean>(false);
  const [retriesCount, setRetriesCount] = useState<number>(0);
  const [imgError, setImgError] = useState<boolean>(false);
  const MAX_RETRIES = 2;

  // Actualizar la fuente de la imagen cuando cambia la prop src
  useEffect(() => {
    if (src !== imgSrc && !fallbackActive) {
      setImgSrc(src);
      setFallbackActive(false);
      setRetriesCount(0);
      setImgError(false);
    }
  }, [src]);

  // Función para añadir un parámetro de cache-busting a la URL
  const cacheBustUrl = (url: string): string => {
    if (!url) return '';
    
    try {
      // Crear un objeto URL para manipular la URL correctamente
      const urlObj = new URL(url);
      // Añadir o actualizar el timestamp para evitar cacheo
      urlObj.searchParams.set('t', Date.now().toString());
      return urlObj.toString();
    } catch (e) {
      console.error('Error parsing URL for cache busting:', e);
      // Fallback: simple string manipulation
      return url.includes('?') 
        ? `${url}&t=${Date.now()}` 
        : `${url}?t=${Date.now()}`;
    }
  };

  // Función para obtener la clave S3 de una URL
  const extractS3Key = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Para URLs de CloudFront o S3
      if (pathname.includes('/images/')) {
        // Extraer la parte después de /images/
        const pathParts = pathname.split('/images/');
        if (pathParts.length > 1) {
          return `images/${pathParts[1].split('?')[0]}`; // Eliminar query params
        }
      }
      
      // Para URLs de videos
      if (pathname.includes('/videos/')) {
        const pathParts = pathname.split('/videos/');
        if (pathParts.length > 1) {
          return `videos/${pathParts[1].split('?')[0]}`; // Eliminar query params
        }
      }
      
      // Si no encontramos un patrón conocido, retornar la ruta completa sin query params
      return pathname.startsWith('/') ? pathname.substring(1).split('?')[0] : pathname.split('?')[0];
    } catch (e) {
      console.error('Error extracting S3 key:', e);
      return null;
    }
  };

  // Función para refrescar una URL expirada a través de la API
  const refreshImageUrl = async (url: string): Promise<string | null> => {
    try {
      const key = extractS3Key(url);
      if (!key) {
        console.warn('Could not extract S3 key from URL:', url);
        return null;
      }
      
      console.log('Refreshing URL with key:', key);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await axios.get(`${apiUrl}/api/images/refresh-url`, {
        params: { key }
      });
      
      if (response.data && response.data.url) {
        console.log('Received refreshed URL from API:', response.data.url.substring(0, 100) + '...');
        return response.data.url;
      }
      
      return null;
    } catch (e) {
      console.error('Error refreshing image URL:', e);
      return null;
    }
  };

  // Manejar error de carga de la imagen
  const handleError = async () => {
    console.error(`Image failed to load (retry ${retriesCount}/${MAX_RETRIES}):`, imgSrc);
    
    // Incrementar contador de intentos
    const newRetryCount = retriesCount + 1;
    setRetriesCount(newRetryCount);
    
    // Si hemos alcanzado el máximo de intentos, mostrar placeholder
    if (newRetryCount > MAX_RETRIES) {
      console.log(`Max retries (${MAX_RETRIES}) reached. Using placeholder.`);
      setImgError(true);
      return;
    }
    
    // Activar modo de fallback
    setFallbackActive(true);
    
    if (newRetryCount === 1) {
      // Primer intento: añadir cache-busting
      const bustedUrl = cacheBustUrl(src);
      console.log(`Retry ${newRetryCount}/${MAX_RETRIES}: Using cache-busted URL`);
      setImgSrc(bustedUrl);
    } else {
      // Segundo intento: refrescar la URL a través de la API
      console.log(`Retry ${newRetryCount}/${MAX_RETRIES}: Trying to refresh URL via API`);
      
      const refreshedUrl = await refreshImageUrl(src);
      if (refreshedUrl) {
        console.log('Using refreshed URL from API');
        setImgSrc(refreshedUrl);
      } else {
        console.warn('Failed to refresh URL via API, using placeholder');
        setImgError(true);
      }
    }
  };

  // Renderizar un placeholder si hay error
  if (imgError) {
    return (
      <div className={`${placeholderClassName || className}`} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f0f0',
        color: '#666',
        fontSize: '2rem',
        fontWeight: 'bold',
        width: '100%',
        height: '100%',
        minHeight: '80px',
      }}>
        {alt ? alt.charAt(0).toUpperCase() : '?'}
      </div>
    );
  }

  // Renderizar la imagen con manejo de errores
  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      crossOrigin="anonymous" // Importante para CloudFront
    />
  );
};

export default ImageFallback; 