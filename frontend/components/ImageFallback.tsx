import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ImageFallbackProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  style?: React.CSSProperties;
}

const ImageFallback: React.FC<ImageFallbackProps> = ({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  style,
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
  }, [src, imgSrc, fallbackActive]);

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
      
      console.log('Extracting key from pathname:', pathname);
      
      // Para URLs de CloudFront o S3
      if (pathname.includes('/images/')) {
        // Extraer la parte después de /images/
        const pathParts = pathname.split('/images/');
        if (pathParts.length > 1) {
          const key = `images/${pathParts[1].split('?')[0]}`; // Eliminar query params
          console.log('Extracted key (images):', key);
          return key;
        }
      }
      
      // Para URLs de videos
      if (pathname.includes('/videos/')) {
        const pathParts = pathname.split('/videos/');
        if (pathParts.length > 1) {
          const key = `videos/${pathParts[1].split('?')[0]}`; // Eliminar query params
          console.log('Extracted key (videos):', key);
          return key;
        }
      }
      
      // Si no encontramos un patrón conocido, retornar la ruta completa sin query params
      const key = pathname.startsWith('/') ? pathname.substring(1).split('?')[0] : pathname.split('?')[0];
      console.log('Extracted key (fallback):', key);
      return key;
    } catch (e) {
      console.error('Error extracting S3 key from URL:', url, e);
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
      
      // Calcular baseURL para la API como en api-client.ts
      let apiBaseUrl = '/api';
      if (process.env.NEXT_PUBLIC_API_URL) {
        apiBaseUrl = process.env.NEXT_PUBLIC_API_URL.endsWith('/api') 
          ? process.env.NEXT_PUBLIC_API_URL 
          : `${process.env.NEXT_PUBLIC_API_URL}/api`;
      }
      
      console.log('Refreshing image URL with key:', key);
      console.log('Using API base URL:', apiBaseUrl);
      
      const response = await axios.get(`${apiBaseUrl}/images/refresh-url`, {
        params: { key }
      });
      
      if (response.data && response.data.url) {
        console.log('Received refreshed URL:', response.data.url);
        return response.data.url;
      }
      
      console.warn('API returned success but no URL in the response');
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
      console.error('Maximum retries reached, showing placeholder');
      setImgError(true);
      return;
    }
    
    // Activar modo de fallback
    setFallbackActive(true);
    
    if (newRetryCount === 1) {
      // Primer intento: añadir cache-busting
      const bustedUrl = cacheBustUrl(src);
      console.log('Retry with cache busting:', bustedUrl);
      setImgSrc(bustedUrl);
    } else {
      // Segundo intento: refrescar la URL a través de la API
      console.log('Trying to refresh URL via API');
      
      const refreshedUrl = await refreshImageUrl(src);
      if (refreshedUrl) {
        console.log('Using refreshed URL:', refreshedUrl);
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
      style={style}
      onError={handleError}
      crossOrigin="anonymous" // Importante para CloudFront
    />
  );
};

export default ImageFallback; 