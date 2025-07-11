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
  const [actualVideoSize, setActualVideoSize] = useState<number | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentVideoIdRef = useRef<string | null>(null); // Track current video to prevent duplicate sessions
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

  // Get actual video file size from HTTP headers
  const getActualVideoSize = useCallback(async (videoUrl: string) => {
    try {
      const response = await fetch(videoUrl, { 
        method: 'HEAD',
        headers: {
          'Range': 'bytes=0-0' // Just get headers, not content
        }
      });
      
      const contentLength = response.headers.get('Content-Length');
      const contentRange = response.headers.get('Content-Range');
      
      if (contentRange) {
        // Content-Range: bytes 0-0/1843200 (total size is after the /)
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          const size = parseInt(match[1], 10);
          console.log(`Got actual video size from Content-Range: ${size} bytes (${(size/1024/1024).toFixed(2)} MB)`);
          setActualVideoSize(size);
          return size;
        }
      }
      
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        console.log(`Got actual video size from Content-Length: ${size} bytes (${(size/1024/1024).toFixed(2)} MB)`);
        setActualVideoSize(size);
        return size;
      }
      
      console.log('Could not determine actual video size from headers');
      setActualVideoSize(null);
      return null;
    } catch (error) {
      console.log('Error getting video size:', error);
      setActualVideoSize(null);
      return null;
    }
  }, []);

  // Start streaming session tracking
  const startStreamingSession = useCallback(async () => {
    if (!classId || !schoolId || sessionId) {
      console.log('Skipping session start:', { hasClassId: !!classId, hasSchoolId: !!schoolId, hasSessionId: !!sessionId });
      return;
    }

    try {
      console.log('Starting streaming session for:', { classId, schoolId, courseId });
      
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
      
      console.log('Session started:', response.sessionId);

    } catch (error) {
      console.error('Error starting streaming session:', error);
      // Don't fail video playback if tracking fails
    }
  }, [classId, schoolId, courseId, sessionId]);

  // End streaming session tracking
  const endStreamingSession = useCallback(async () => {
    if (!sessionId || !videoRef.current) return;

    try {
      // Calculate final bytes using same method as updateBytesTransferred
      const video = videoRef.current;
      const currentTime = video.currentTime || 0;
      const duration = video.duration || 0;

      let finalBytesTransferred = 0;
      
      if (duration > 0) {
        let fileSize = 0;
        
        if (actualVideoSize) {
          fileSize = actualVideoSize;
        } else {
          // Fallback estimation
          const width = video.videoWidth || 0;
          const height = video.videoHeight || 0;
          const pixels = width * height;
          
          if (pixels > 0) {
            let bytesPerPixelPerSecond = 0.25;
            
            if (pixels >= 1920 * 1080) {
              bytesPerPixelPerSecond = 0.35;
            } else if (pixels >= 1280 * 720) {
              bytesPerPixelPerSecond = 0.3;
            } else {
              bytesPerPixelPerSecond = 0.2;
            }
            
            fileSize = pixels * duration * bytesPerPixelPerSecond;
          } else {
            fileSize = duration * 500000;
          }
        }

        const watchProgress = currentTime / duration;
        finalBytesTransferred = Math.floor(fileSize * watchProgress);
      }
      
      const sessionDuration = startTime ? (Date.now() - startTime) / 1000 : 0; // Duration in seconds
      console.log(`Ending session: ${currentTime.toFixed(1)}s/${duration.toFixed(1)}s watched, ${finalBytesTransferred} bytes transferred, session lasted ${sessionDuration.toFixed(1)}s`);
      
      await UsageTrackingService.endStreamingSession(sessionId, finalBytesTransferred);

      setSessionId(null);
      setStartTime(null);
      setBytesTransferred(0);
      currentVideoIdRef.current = null;
    } catch (error) {
      console.error('Error ending streaming session:', error);
    }
  }, [sessionId]);

  // Calculate bytes transferred based on actual video properties
  const updateBytesTransferred = useCallback(() => {
    if (!videoRef.current || !startTime) return;

    const video = videoRef.current;
    const currentTime = video.currentTime || 0;
    const duration = video.duration || 0;

    if (duration === 0) return; // Can't calculate without duration

    // Use actual video size if available, otherwise estimate
    let fileSize = 0;
    
    if (actualVideoSize) {
      // Use the actual file size - much more accurate!
      fileSize = actualVideoSize;
      console.log(`Using actual video size: ${fileSize} bytes`);
    } else {
      // Fallback to estimation only when actual size is unavailable
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      const pixels = width * height;
      
      if (pixels > 0) {
        let bytesPerPixelPerSecond = 0.25;
        
        if (pixels >= 1920 * 1080) {
          bytesPerPixelPerSecond = 0.35;
        } else if (pixels >= 1280 * 720) {
          bytesPerPixelPerSecond = 0.3;
        } else {
          bytesPerPixelPerSecond = 0.2;
        }
        
        fileSize = pixels * duration * bytesPerPixelPerSecond;
      } else {
        fileSize = duration * 500000; // Fallback estimate
      }
      console.log(`Using estimated video size: ${fileSize} bytes`);
    }

    // Calculate proportional bytes based on watch progress
    const watchProgress = currentTime / duration;
    const estimatedBytes = Math.floor(fileSize * watchProgress);
    
    setBytesTransferred(estimatedBytes);
    
    console.log(`Tracking: ${currentTime.toFixed(1)}s/${duration.toFixed(1)}s (${(watchProgress*100).toFixed(1)}%) = ${estimatedBytes} bytes (total: ${Math.floor(fileSize)} bytes)`);
  }, [startTime]);

  // Function to get streaming URL
  const getStreamingUrl = useCallback(async () => {
    // If we already have a URL, use it directly
    if (url) {
      setStreamUrl(url);
      setIsLoading(false);
      // Get actual video file size
      getActualVideoSize(url);
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
      
      // First try without authentication for public classes
      try {
        const response = await fetch(`/api/classes/${classId}/stream-url`);
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.url) {
            setStreamUrl(data.url);
            setError(null);
            setIsLoading(false);
            // Get actual video file size
            getActualVideoSize(data.url);
            return;
          }
        }
      } catch (streamError) {
        console.log('Streaming endpoint failed without auth, trying with auth:', streamError);
      }

      // If unauthenticated request failed, try with authentication
      try {
        const token = Cookies.get('token');
        if (token) {
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
              // Get actual video file size
              getActualVideoSize(data.url);
              return;
            }
          }
        }
        
        // If response is not ok but no exception, continue to fallback
        console.log('Streaming endpoint returned non-ok status, trying fallback');
      } catch (authStreamError) {
        console.log('Streaming endpoint failed with auth, trying fallback:', authStreamError);
      }
      
      // Try direct class endpoint without auth
      try {
        const response = await api.get(`/classes/${classId}`, {
          headers: { 'Skip-Auth': 'true' }
        });
        if (response.data && response.data.videoUrl && response.data.videoUrl.trim()) {
          console.log('Successfully got stream URL for class', classId, '(without auth)');
          setStreamUrl(response.data.videoUrl);
          setError(null);
          setIsLoading(false);
          // Get actual video file size
          getActualVideoSize(response.data.videoUrl);
          return;
        }
      } catch (directError) {
        console.log('Error with direct URL without auth, trying with auth:', directError);
      }

      // Try direct class endpoint with auth
      try {
        const response = await api.get(`/classes/${classId}`);
        if (response.data && response.data.videoUrl && response.data.videoUrl.trim()) {
          console.log('Successfully got stream URL for class', classId, '(with auth)');
          setStreamUrl(response.data.videoUrl);
          setError(null);
          setIsLoading(false);
          // Get actual video file size
          getActualVideoSize(response.data.videoUrl);
          return;
        }
      } catch (directError) {
        console.log('Error with direct URL with auth:', directError);
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
    
    // Auto fullscreen on mobile devices
    if (isMobile && videoRef.current) {
      const video = videoRef.current;
      
      // Small delay to ensure video is ready
      setTimeout(() => {
        // Request fullscreen on mobile using various browser APIs
        if (video.requestFullscreen) {
          video.requestFullscreen().catch(console.log);
        } else if ((video as any).webkitRequestFullscreen) {
          (video as any).webkitRequestFullscreen().catch(console.log);
        } else if ((video as any).mozRequestFullScreen) {
          (video as any).mozRequestFullScreen().catch(console.log);
        } else if ((video as any).msRequestFullscreen) {
          (video as any).msRequestFullscreen().catch(console.log);
        }
      }, 100);
    }
    
    // Only start session if we don't have one already
    const currentVideoId = classId || url || null;
    
    if (!sessionId) {
      console.log('Starting new session on play for video:', currentVideoId);
      currentVideoIdRef.current = currentVideoId;
      startStreamingSession();
    } else {
      console.log('Session already active, continuing playback');
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    updateBytesTransferred();
    // Don't end session on pause - user might resume
    console.log('Video paused, session continues');
  };

  const handleEnded = () => {
    setIsPlaying(false);
    updateBytesTransferred();
    console.log('Video ended naturally, ending session');
    endStreamingSession();
  };

  const handleTimeUpdate = () => {
    updateBytesTransferred();
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Error playing video:', e);
    setIsPlaying(false);
    
    // If this is the first error and we have retries left, don't show error - just retry
    if (retryCount === 0) {
      console.log('Video error on first load, attempting retry...');
      setStreamUrl(null); // Clear the bad URL
      setIsLoading(true);
      setRetryCount(1);
      return;
    }
    
    setError("Error al reproducir el video. El formato puede no ser compatible o el archivo puede estar dañado.");
    endStreamingSession();
  };

  // Initialize video URL
  useEffect(() => {
    getStreamingUrl();
  }, [getStreamingUrl, retryCount]);

  // Re-initialize when URL prop changes (but not when sessionId changes)
  useEffect(() => {
    if (url) {
      // Only end session if this is a completely different video URL
      const currentVideoId = classId || url || null;
      if (sessionId && currentVideoId !== currentVideoIdRef.current) {
        console.log('Different video URL detected, ending current session');
        endStreamingSession();
      }
      setStreamUrl(null);
      setIsLoading(true);
      setError(null);
      getStreamingUrl();
    }
  }, [url, getStreamingUrl]); // Removed sessionId and endStreamingSession from dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        console.log('Component unmounting, ending session');
        endStreamingSession();
      }
    };
  }, []);

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