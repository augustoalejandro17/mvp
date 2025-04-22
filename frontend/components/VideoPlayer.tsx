import { useState, useEffect, useRef } from 'react';
import styles from '../styles/VideoPlayer.module.css';
import axios from 'axios';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  poster?: string;
  onError?: (error: any) => void;
  className?: string;
  classId?: string;
}

export default function VideoPlayer({ 
  videoUrl, 
  title = 'Video',
  poster = '/video-placeholder.jpg',
  onError,
  className = '',
  classId
}: VideoPlayerProps) {
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [retry, setRetry] = useState<number>(0);
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [streamingUrl, setStreamingUrl] = useState<string>(videoUrl);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Prevenir la descarga del video mediante el menú contextual
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  // Obtener la URL de streaming si tenemos classId
  useEffect(() => {
    if (classId) {
      const fetchStreamingUrl = async () => {
        try {
          setLoading(true);
          
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
          const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
          
          if (!token) {
            console.warn('No se encontró token de autenticación');
            setStreamingUrl(videoUrl);
            return;
          }
          
          const response = await axios.get(`${apiUrl}/api/classes/${classId}/stream-url`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data && response.data.url) {
            console.log(`URL de streaming obtenida correctamente${response.data.isCloudFront ? ' (CloudFront)' : ' (S3)'}`);
            setStreamingUrl(response.data.url);
          } else {
            console.warn('La respuesta no contiene una URL válida', response.data);
            setStreamingUrl(videoUrl);
          }
        } catch (err) {
          console.error('Error al obtener URL de streaming:', err);
          setStreamingUrl(videoUrl);
        } finally {
          // No desactivamos el loading aquí, eso lo hace el evento loadeddata del video
        }
      };
      
      fetchStreamingUrl();
    }
  }, [classId, videoUrl]);

  // Función para limpiar URLs para mostrar
  const getCleanUrl = (url: string): string => {
    // Si la URL es muy larga, mostrar solo una versión recortada
    if (url && url.length > 60) {
      return url.substring(0, 30) + '...' + url.substring(url.length - 20);
    }
    return url || 'No disponible';
  };

  // Función para determinar el tipo de video basado en la extensión
  const getVideoType = (url: string): string => {
    if (!url) return 'video/mp4';
    
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'ogg': return 'video/ogg';
      case 'mov': return 'video/mp4'; // Los archivos .mov suelen reproducirse bien como mp4
      case 'avi': return 'video/x-msvideo';
      default: return 'video/mp4';
    }
  };

  // Función para manejar errores de video
  const handleVideoError = (e: any) => {
    console.error('Error de reproducción de video:', e);
    
    // Extraer detalles del error si es posible
    let errorMsg = 'Error al cargar el video.';
    if (e.target && e.target.error) {
      const mediaError = e.target.error;
      switch (mediaError.code) {
        case mediaError.MEDIA_ERR_ABORTED:
          errorMsg = 'La reproducción del video fue abortada.';
          break;
        case mediaError.MEDIA_ERR_NETWORK:
          errorMsg = 'Error de red al cargar el video.';
          break;
        case mediaError.MEDIA_ERR_DECODE:
          errorMsg = 'Error al decodificar el video. El formato podría no ser compatible.';
          break;
        case mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = 'El formato de video no es compatible con este navegador.';
          break;
        default:
          errorMsg = `Error desconocido (${mediaError.code}).`;
      }
    }
    
    setErrorDetails(errorMsg);
    setError(true);
    setLoading(false);
    
    // Notificar del error si se proporcionó un callback
    if (onError) {
      onError(e);
    }
  };

  // Función para reintentar la reproducción
  const handleRetry = () => {
    setError(false);
    setLoading(true);
    setRetry(prev => prev + 1);
    
    // Intentar cargar el video de nuevo
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  // Manejar el evento loadeddata para actualizar el estado de carga
  useEffect(() => {
    const handleVideoLoaded = () => {
      setLoading(false);
    };
    
    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadeddata', handleVideoLoaded);
      
      return () => {
        video.removeEventListener('loadeddata', handleVideoLoaded);
      };
    }
  }, [retry]);

  return (
    <div className={`${styles.container} ${className}`}>
      {loading && !error && (
        <div className={styles.loadingIndicator}>
          <div className={styles.spinner}></div>
          <p>Cargando video...</p>
        </div>
      )}
      
      {error ? (
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>
            {errorDetails || 'No se pudo cargar el video en el reproductor.'}
          </p>
          <div className={styles.errorDetails}>
            URL: {getCleanUrl(streamingUrl)}
          </div>
          <div className={styles.errorActions}>
            <button 
              onClick={handleRetry} 
              className={styles.retryButton}
            >
              Reintentar
            </button>
            <a 
              href={streamingUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.openButton}
            >
              Abrir video en nueva pestaña
            </a>
          </div>
        </div>
      ) : (
        <div 
          className={styles.videoWrapper} 
          onContextMenu={handleContextMenu}
        >
          <video
            ref={videoRef}
            className={styles.videoPlayer}
            controls
            playsInline
            poster={poster}
            aria-label={title}
            key={`video-${retry}`}
            onError={handleVideoError}
            preload="auto"
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            onContextMenu={handleContextMenu}
          >
            <source src={streamingUrl} type="video/mp4" />
            <p>Tu navegador no soporta la reproducción de videos.</p>
          </video>
        </div>
      )}
    </div>
  );
} 