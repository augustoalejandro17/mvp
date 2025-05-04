import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../styles/VideoPlayer.module.css';
import api from '../utils/api-client';
import Cookies from 'js-cookie';

interface VideoPlayerProps {
  url?: string;
  title?: string;
  classId?: string;
  allowDownload?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, classId, allowDownload = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxRetries = 2; // Máximo número de reintentos

  // Función para obtener la URL de streaming de manera robusta 
  const getStreamingUrl = useCallback(async () => {
    if (!classId) {
      // Si no hay classId pero hay una URL, usarla directamente
      if (url) {
        setStreamUrl(url);
        setIsLoading(false);
        return;
      } else {
        setError("No se puede reproducir el video sin un ID de clase o URL");
        setIsLoading(false);
        return;
      }
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Intentar usar el endpoint de streaming en primer lugar
      try {
        const token = Cookies.get('token');
        const response = await fetch(`/api/classes/${classId}/stream-url`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.url) {
            setStreamUrl(data.url);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
      } catch (streamError) {
        console.warn('Error con endpoint de streaming, usando alternativa', streamError);
      }
      
      // Si llegamos aquí, es porque el primer intento falló
      // Intentemos usar alternativas
      
      // Opción 1: Intentar con el endpoint directo
      try {
        const response = await api.get(`/classes/${classId}`);
        if (response.data && response.data.videoUrl) {
          console.log('Usando URL directa de video de la clase');
          setStreamUrl(response.data.videoUrl);
          setError(null);
          setIsLoading(false);
          return;
        }
      } catch (directError) {
        console.warn('Error con URL directa, intentando última alternativa', directError);
      }

      // Si llegamos aquí, todos los intentos han fallado
      setError("No se pudo obtener la URL del video. Intente de nuevo más tarde.");
      setIsLoading(false);
    } catch (error) {
      console.error('Error al obtener URL de streaming:', error);
      setError("Error al cargar el video. Por favor, intenta de nuevo más tarde.");
      setIsLoading(false);
    }
  }, [classId, url]);

  // Iniciar la carga de la URL cuando el componente se monta
  useEffect(() => {
    getStreamingUrl();
  }, [getStreamingUrl, retryCount]);

  // Función para reintentar la carga del video
  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
    } else {
      setError("Se alcanzó el número máximo de intentos. Por favor, inténtelo más tarde.");
    }
  };

  // Video player attributes
  const videoAttrs = {
    ref: videoRef,
    src: streamUrl || undefined,
    controls: true,
    autoPlay: false,
    className: styles.video,
    poster: '/video-poster.jpg',
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onEnded: () => setIsPlaying(false),
    onError: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      console.error('Error playing video:', e);
      setIsPlaying(false);
      setError("Error al reproducir el video. El formato puede no ser compatible o el archivo puede estar dañado.");
    },
  };

  // Handle video download
  const handleDownload = async () => {
    if (!classId || !allowDownload) return;
    
    try {
      setIsDownloading(true);
      setDownloadError(null);
      
      const response = await api.get(`/classes/${classId}/download-url`);
      
      if (response.data && response.data.url) {
        // Create a temporary anchor element to trigger download
        const a = document.createElement('a');
        a.href = response.data.url;
        a.download = response.data.filename || `${title || 'video'}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setDownloadError('No se pudo obtener la URL de descarga');
      }
    } catch (error) {
      console.error('Download error:', error);
      setDownloadError('Error al descargar el video');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Cargando video...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
        {retryCount < maxRetries && (
          <button 
            className={styles.retryButton}
            onClick={handleRetry}
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div className={styles.noVideo}>
        <p>No hay video disponible</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.videoWrapper}>
        <video {...videoAttrs} />
      </div>
      
      {allowDownload && classId && (
        <div className={styles.downloadContainer}>
          <button 
            className={styles.downloadButton}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? 'Downloading...' : 'Download Video'}
          </button>
          {downloadError && <p className={styles.error}>{downloadError}</p>}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer; 