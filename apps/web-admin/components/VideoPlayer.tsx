import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../styles/VideoPlayer.module.css';
import api from '../utils/api-client';
import Cookies from 'js-cookie';

// Constants for localStorage keys
const STORAGE_KEYS = {
  VOLUME: 'intihubs_video_volume',
  PLAYBACK_RATE: 'intihubs_video_playback_rate',
  MUTED: 'intihubs_video_muted',
};

// Available playback rates
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface VideoPlayerProps {
  url?: string;
  title?: string;
  classId?: string;
  allowDownload?: boolean;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  url, 
  title, 
  classId, 
  allowDownload = false,
  onTimeUpdate 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 2;

  // Load saved preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
      const savedRate = localStorage.getItem(STORAGE_KEYS.PLAYBACK_RATE);
      const savedMuted = localStorage.getItem(STORAGE_KEYS.MUTED);
      
      if (videoRef.current) {
        if (savedVolume) videoRef.current.volume = parseFloat(savedVolume);
        if (savedMuted) videoRef.current.muted = savedMuted === 'true';
      }
      if (savedRate) setPlaybackRate(parseFloat(savedRate));
    }
  }, [streamUrl]);

  // Apply playback rate when it changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, streamUrl]);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if the video container is focused or video is playing
      if (!containerRef.current?.contains(document.activeElement) && 
          document.activeElement?.tagName !== 'VIDEO' &&
          !isPlaying) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      // Don't handle if user is typing in an input
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          localStorage.setItem(STORAGE_KEYS.VOLUME, video.volume.toString());
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          localStorage.setItem(STORAGE_KEYS.VOLUME, video.volume.toString());
          break;
        case 'm':
          e.preventDefault();
          video.muted = !video.muted;
          localStorage.setItem(STORAGE_KEYS.MUTED, video.muted.toString());
          break;
        case 'f':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            video.requestFullscreen?.();
          }
          break;
        case '.':
        case '>':
          e.preventDefault();
          const nextRateIndex = PLAYBACK_RATES.indexOf(playbackRate) + 1;
          if (nextRateIndex < PLAYBACK_RATES.length) {
            const newRate = PLAYBACK_RATES[nextRateIndex];
            setPlaybackRate(newRate);
            localStorage.setItem(STORAGE_KEYS.PLAYBACK_RATE, newRate.toString());
          }
          break;
        case ',':
        case '<':
          e.preventDefault();
          const prevRateIndex = PLAYBACK_RATES.indexOf(playbackRate) - 1;
          if (prevRateIndex >= 0) {
            const newRate = PLAYBACK_RATES[prevRateIndex];
            setPlaybackRate(newRate);
            localStorage.setItem(STORAGE_KEYS.PLAYBACK_RATE, newRate.toString());
          }
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const percent = parseInt(e.key) / 10;
          video.currentTime = video.duration * percent;
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHint(!showKeyboardHint);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, playbackRate, showKeyboardHint]);

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
      // First try without authentication for public classes
      try {
        const response = await fetch(`/api/classes/${classId}/stream-url`);
        
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
        console.warn('Error con endpoint de streaming sin auth, intentando con auth', streamError);
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
              return;
            }
          }
        }
      } catch (authStreamError) {
        console.warn('Error con endpoint de streaming con auth, usando alternativa', authStreamError);
      }
      
      // Si llegamos aquí, es porque el primer intento falló
      // Intentemos usar alternativas
      
      // Opción 1: Intentar con el endpoint directo sin auth
      try {
        const response = await api.get(`/classes/${classId}`, {
          headers: { 'Skip-Auth': 'true' }
        });
        if (response.data && response.data.videoUrl) {
          console.log('Usando URL directa de video de la clase (sin auth)');
          setStreamUrl(response.data.videoUrl);
          setError(null);
          setIsLoading(false);
          return;
        }
      } catch (directError) {
        console.warn('Error con URL directa sin auth, intentando con auth', directError);
      }

      // Opción 2: Intentar con el endpoint directo con auth
      try {
        const response = await api.get(`/classes/${classId}`);
        if (response.data && response.data.videoUrl) {
          console.log('Usando URL directa de video de la clase (con auth)');
          setStreamUrl(response.data.videoUrl);
          setError(null);
          setIsLoading(false);
          return;
        }
      } catch (directError) {
        console.warn('Error con URL directa con auth, intentando última alternativa', directError);
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

  // Handle play event with mobile fullscreen
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
  };

  // Handle time update for progress tracking
  const handleTimeUpdate = () => {
    if (videoRef.current && onTimeUpdate) {
      onTimeUpdate(videoRef.current.currentTime, videoRef.current.duration);
    }
  };

  // Handle volume change to persist
  const handleVolumeChange = () => {
    if (videoRef.current) {
      localStorage.setItem(STORAGE_KEYS.VOLUME, videoRef.current.volume.toString());
      localStorage.setItem(STORAGE_KEYS.MUTED, videoRef.current.muted.toString());
    }
  };

  // Handle playback rate change
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    localStorage.setItem(STORAGE_KEYS.PLAYBACK_RATE, rate.toString());
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Show controls on mouse move
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // Video player attributes with download protection
  const videoAttrs = {
    ref: videoRef,
    src: streamUrl || undefined,
    controls: true,
    autoPlay: false,
    className: styles.video,
    poster: '/video-poster.jpg',
    controlsList: "nodownload noremoteplayback",
    disablePictureInPicture: false,
    onPlay: handlePlay,
    onPause: () => setIsPlaying(false),
    onEnded: () => setIsPlaying(false),
    onTimeUpdate: handleTimeUpdate,
    onVolumeChange: handleVolumeChange,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onError: (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      console.error('Error playing video:', e);
      setIsPlaying(false);
      setError("Error al reproducir el video. El formato puede no ser compatible o el archivo puede estar dañado.");
    },
  };

  // Keyboard shortcuts reference
  const keyboardShortcuts = [
    { key: 'Espacio / K', action: 'Reproducir / Pausar' },
    { key: '← / J', action: 'Retroceder 10s' },
    { key: '→ / L', action: 'Avanzar 10s' },
    { key: '↑ / ↓', action: 'Subir / Bajar volumen' },
    { key: 'M', action: 'Silenciar' },
    { key: 'F', action: 'Pantalla completa' },
    { key: '< / >', action: 'Cambiar velocidad' },
    { key: '0-9', action: 'Saltar a %' },
  ];

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
        <div className={styles.loadingSpinner} />
        <p>Cargando video...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <div className={styles.errorIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
          </svg>
        </div>
        <p className={styles.errorMessage}>{error}</p>
        {retryCount < maxRetries && (
          <button 
            className={styles.retryButton}
            onClick={handleRetry}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reintentar
          </button>
        )}
        <button 
          className={styles.reportButton}
          onClick={() => window.open('mailto:hola@intihubs.com?subject=Problema con video', '_blank')}
        >
          Reportar problema
        </button>
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div className={styles.noVideo}>
        <div className={styles.noVideoIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M2 6l5 5m0-5l-5 5m15 1l5 5m0-5l-5 5" strokeLinecap="round" />
          </svg>
        </div>
        <p>No hay video disponible</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`${styles.container} ${showControls ? styles.showControls : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      tabIndex={0}
      role="region"
      aria-label={`Reproductor de video: ${title || 'Video'}`}
    >
      <div className={styles.videoWrapper}>
        <video {...videoAttrs} />
        
        {/* Playback rate indicator */}
        {playbackRate !== 1 && (
          <div className={styles.playbackRateIndicator}>
            {playbackRate}x
          </div>
        )}

        {/* Custom controls overlay */}
        <div className={`${styles.customControls} ${showControls || !isPlaying ? styles.visible : ''}`}>
          {/* Playback rate selector */}
          <div className={styles.playbackRateSelector}>
            <span className={styles.controlLabel}>Velocidad:</span>
            <select 
              value={playbackRate} 
              onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
              className={styles.rateSelect}
              aria-label="Velocidad de reproducción"
            >
              {PLAYBACK_RATES.map(rate => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </div>

          {/* Keyboard hint toggle */}
          {!isMobile && (
            <button 
              className={styles.keyboardHintToggle}
              onClick={() => setShowKeyboardHint(!showKeyboardHint)}
              aria-label="Mostrar atajos de teclado"
              title="Atajos de teclado (?)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Keyboard shortcuts overlay */}
        {showKeyboardHint && (
          <div className={styles.keyboardHintOverlay}>
            <div className={styles.keyboardHintContent}>
              <h4>Atajos de teclado</h4>
              <button 
                className={styles.closeHint}
                onClick={() => setShowKeyboardHint(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
              <ul>
                {keyboardShortcuts.map(({ key, action }) => (
                  <li key={key}>
                    <kbd>{key}</kbd>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
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
            {isDownloading ? (
              <>
                <span className={styles.downloadSpinner} />
                Descargando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Descargar video
              </>
            )}
          </button>
          {downloadError && <p className={styles.downloadError}>{downloadError}</p>}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer; 