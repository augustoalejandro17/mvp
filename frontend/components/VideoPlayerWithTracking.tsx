import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../styles/VideoPlayer.module.css';
import api from '../utils/api-client';
import Cookies from 'js-cookie';
import UsageTrackingService from './UsageTrackingService';

interface VideoPlayerWithTrackingProps {
  url?: string;
  title?: string;
  classId?: string;
  courseId?: string;
  schoolId?: string;
  allowDownload?: boolean;
}

const VideoPlayerWithTracking: React.FC<VideoPlayerWithTrackingProps> = ({ 
  url, 
  title, 
  classId, 
  courseId,
  schoolId,
  allowDownload = false 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Usage tracking state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [bytesTransferred, setBytesTransferred] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxRetries = 2;

  // Device detection
  const getDeviceType = (): 'mobile' | 'desktop' | 'tablet' => {
    const userAgent = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  };

  // Estimate video quality based on video element properties
  const getVideoQuality = (): 'low' | 'medium' | 'high' => {
    if (!videoRef.current) return 'medium';
    
    const video = videoRef.current;
    const width = video.videoWidth;
    
    if (width >= 1920) return 'high';
    if (width >= 1280) return 'medium';
    return 'low';
  };

  // Start streaming session tracking
  const startStreamingSession = useCallback(async () => {
    if (!classId || !schoolId || sessionId) return;

    try {
      const response = await UsageTrackingService.startStreamingSession({
        assetId: classId,
        schoolId: schoolId,
        relatedCourse: courseId,
        relatedClass: classId,
        quality: getVideoQuality(),
        deviceType: getDeviceType()
      });

      setSessionId(response.sessionId);
      setStartTime(Date.now());
      console.log('Streaming session started:', response.sessionId);
    } catch (error) {
      console.error('Error starting streaming session:', error);
      // Don't fail video playback if tracking fails
    }
  }, [classId, schoolId, courseId, sessionId]);

  // End streaming session tracking
  const endStreamingSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await UsageTrackingService.endStreamingSession(sessionId, bytesTransferred);
      console.log('Streaming session ended:', sessionId);
      setSessionId(null);
      setStartTime(null);
      setBytesTransferred(0);
    } catch (error) {
      console.error('Error ending streaming session:', error);
    }
  }, [sessionId, bytesTransferred]);

  // Estimate bytes transferred (rough calculation)
  const updateBytesTransferred = useCallback(() => {
    if (!videoRef.current || !startTime) return;

    const video = videoRef.current;
    const duration = video.duration || 0;
    const currentTime = video.currentTime || 0;
    const quality = getVideoQuality();

    // Rough bitrate estimates (in bytes per second)
    const bitrateEstimates = {
      low: 125000,    // 1 Mbps
      medium: 312500, // 2.5 Mbps  
      high: 625000    // 5 Mbps
    };

    const estimatedBytes = currentTime * bitrateEstimates[quality];
    setBytesTransferred(estimatedBytes);
  }, [startTime]);

  // Function to get streaming URL
  const getStreamingUrl = useCallback(async () => {
    if (!classId) {
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

      setError("No se pudo obtener la URL del video. Intente de nuevo más tarde.");
      setIsLoading(false);
    } catch (error) {
      console.error('Error al obtener URL de streaming:', error);
      setError("Error al cargar el video. Por favor, intenta de nuevo más tarde.");
      setIsLoading(false);
    }
  }, [classId, url]);

  // Video event handlers
  const handlePlay = () => {
    setIsPlaying(true);
    startStreamingSession();
  };

  const handlePause = () => {
    setIsPlaying(false);
    updateBytesTransferred();
  };

  const handleEnded = () => {
    setIsPlaying(false);
    updateBytesTransferred();
    endStreamingSession();
  };

  const handleTimeUpdate = () => {
    updateBytesTransferred();
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Error playing video:', e);
    setIsPlaying(false);
    setError("Error al reproducir el video. El formato puede no ser compatible o el archivo puede estar dañado.");
    endStreamingSession();
  };

  // Initialize video URL
  useEffect(() => {
    getStreamingUrl();
  }, [getStreamingUrl, retryCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        endStreamingSession();
      }
    };
  }, [sessionId, endStreamingSession]);

  // Handle page visibility change (user switches tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isPlaying) {
        updateBytesTransferred();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, updateBytesTransferred]);

  const handleRetry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
    } else {
      setError("Se alcanzó el número máximo de intentos. Por favor, inténtelo más tarde.");
    }
  };

  const handleDownload = async () => {
    if (!classId || !allowDownload) return;
    
    try {
      setIsDownloading(true);
      setDownloadError(null);
      
      const response = await api.get(`/classes/${classId}/download-url`);
      
      if (response.data && response.data.url) {
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
        <div className={styles.spinner}></div>
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
        <video 
          ref={videoRef}
          src={streamUrl}
          controls
          autoPlay={false}
          className={styles.video}
          poster="/video-poster.jpg"
          controlsList="nodownload noremoteplayback" // Disable browser download button
          disablePictureInPicture={false} // Keep picture in picture
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onError={handleError}
          onContextMenu={(e: React.MouseEvent) => e.preventDefault()} // Disable right-click
        />
      </div>
      
      {/* Usage tracking indicator */}
      {sessionId && (
        <div className={styles.trackingIndicator}>
          <span className={styles.trackingIcon}>📊</span>
          <span className={styles.trackingText}>Monitoreando uso</span>
          {bytesTransferred > 0 && (
            <span className={styles.trackingBytes}>
              {UsageTrackingService.formatBytes(bytesTransferred)}
            </span>
          )}
        </div>
      )}
      
      {allowDownload && classId && (
        <div className={styles.downloadContainer}>
          <button 
            className={styles.downloadButton}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? 'Descargando...' : 'Descargar Video'}
          </button>
          {downloadError && <p className={styles.error}>{downloadError}</p>}
        </div>
      )}
    </div>
  );
};

export default VideoPlayerWithTracking; 