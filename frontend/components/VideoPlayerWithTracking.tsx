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
  const [isMobile, setIsMobile] = useState(false);
  
  // Usage tracking state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [bytesTransferred, setBytesTransferred] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const maxRetries = 2;

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    // If we already have a URL, use it directly
    if (url) {
      setStreamUrl(url);
      setIsLoading(false);
      return;
    }
    
    if (!classId) {
      setError("No se puede reproducir el video sin un ID de clase o URL");
      setIsLoading(false);
      return;
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
          setStreamUrl(response.data.videoUrl);
          setError(null);
          setIsLoading(false);
          return;
        }
      } catch (directError) {
        console.warn('Error with direct URL fallback', directError);
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

  // Re-initialize when URL prop changes
  useEffect(() => {
    if (url) {
      setStreamUrl(null);
      setIsLoading(true);
      setError(null);
      getStreamingUrl();
    }
  }, [url, getStreamingUrl]);

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
      <div style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '800px',
        margin: '0 auto',
        position: 'relative',
        backgroundColor: '#000',
        borderRadius: isMobile ? '6px' : '8px'
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          ...(isMobile ? { height: '450px' } : { paddingBottom: '56.25%', height: 0 })
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white'
          }}>
            <div className={styles.spinner}></div>
            <p style={{ marginTop: '16px', fontSize: '16px' }}>Cargando video...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '800px',
        margin: '0 auto',
        position: 'relative',
        backgroundColor: '#000',
        borderRadius: isMobile ? '6px' : '8px'
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          ...(isMobile ? { height: '450px' } : { paddingBottom: '56.25%', height: 0 })
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            padding: '20px',
            textAlign: 'center'
          }}>
            <p style={{ marginBottom: '20px', fontSize: '16px', color: '#ff6b6b' }}>
              ⚠️ {error}
            </p>
            {retryCount < maxRetries && (
              <button 
                onClick={handleRetry}
                style={{
                  backgroundColor: '#3182ce',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                🔄 Reintentar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '800px',
        margin: '0 auto',
        position: 'relative',
        paddingBottom: isMobile ? '45%' : '56.25%',
        height: 0,
        backgroundColor: '#000',
        borderRadius: isMobile ? '6px' : '8px'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#666',
          fontSize: '16px'
        }}>
          <p>No hay video disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: isMobile ? '100%' : '800px',
      margin: '0 auto',
      position: 'relative',
      backgroundColor: '#000',
      borderRadius: isMobile ? '6px' : '8px',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        ...(isMobile ? { height: '450px' } : { paddingBottom: '56.25%', height: 0 })
      }}>
        <video 
          ref={videoRef}
          src={streamUrl}
          controls
          autoPlay={false}
          preload="metadata"
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture={false}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onTimeUpdate={handleTimeUpdate}
          onError={handleError}
          onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%', 
            height: '100%',
            backgroundColor: '#000',
            borderRadius: isMobile ? '6px' : '8px',
            objectFit: 'contain'
          }}
        />
      </div>
      
      {/* Video info overlay */}
      <div style={{
        position: 'absolute',
        top: isMobile ? '8px' : '10px',
        left: isMobile ? '8px' : '10px',
        display: 'flex',
        gap: isMobile ? '6px' : '8px',
        zIndex: 10
      }}>
        {sessionId && isPlaying && (
          <div className={styles.trackingIndicator}>
            <span className={styles.trackingIcon}>🔴</span>
            <span className={styles.trackingText}>En vivo</span>
          </div>
        )}
        
        {bytesTransferred > 0 && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: isMobile ? '4px 6px' : '4px 8px',
            borderRadius: '4px',
            fontSize: isMobile ? '11px' : '12px',
            fontWeight: '500'
          }}>
            {UsageTrackingService.formatBytes(bytesTransferred)}
          </div>
        )}
      </div>
      
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