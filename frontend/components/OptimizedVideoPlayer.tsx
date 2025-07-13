import React, { useRef, useEffect, useState, useCallback } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/themes/dist/forest/index.css';
import styles from '../styles/OptimizedVideoPlayer.module.css';

interface OptimizedVideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
  onReady?: (player: any) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: any) => void;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  fluid?: boolean;
  responsive?: boolean;
  aspectRatio?: string;
  playbackRates?: number[];
  preload?: 'auto' | 'metadata' | 'none';
  crossOrigin?: 'anonymous' | 'use-credentials';
  enableHotkeys?: boolean;
  enableTouchOverlay?: boolean;
  thumbnailUrl?: string;
}

const OptimizedVideoPlayer: React.FC<OptimizedVideoPlayerProps> = ({
  src,
  poster,
  title = 'Video Player',
  className = '',
  onReady,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onError,
  autoplay = false,
  muted = false,
  controls = true,
  fluid = true,
  responsive = true,
  aspectRatio = '16:9',
  playbackRates = [0.5, 1, 1.25, 1.5, 2],
  preload = 'metadata',
  crossOrigin = 'anonymous',
  enableHotkeys = true,
  enableTouchOverlay = true,
  thumbnailUrl
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize Video.js player
  useEffect(() => {
    if (!videoRef.current || !src) return;

    // Cleanup previous player
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    // Create video element
    const videoElement = document.createElement('video');
    videoElement.className = 'video-js vjs-theme-forest';
    videoElement.setAttribute('data-setup', '{}');
    
    // Clear and append video element
    videoRef.current.innerHTML = '';
    videoRef.current.appendChild(videoElement);

    // Video.js options
    const options: any = {
      controls,
      fluid,
      responsive,
      aspectRatio,
      preload,
      poster: poster || thumbnailUrl,
      muted,
      autoplay: autoplay && !isMobile, // Disable autoplay on mobile
      crossOrigin,
      playbackRates,
      html5: {
        vhs: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: true
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
        nativeTextTracks: false
      },
      techOrder: ['html5'],
      sources: [{
        src,
        type: getVideoType(src)
      }],
      // Mobile-optimized settings
      ...(isMobile && {
        playsinline: true,
        disablePictureInPicture: false,
        enableSmoothSeeking: true,
        experimentalSvgIcons: true
      })
    };

    // Initialize player
    const player = videojs(videoElement, options);

    // Configure player for mobile
    if (isMobile) {
      player.ready(() => {
        // Add mobile-specific classes
        player.addClass('vjs-mobile');
        
        // Larger controls for touch
        const controlBar = player.getChild('ControlBar');
        if (controlBar) {
          controlBar.addClass('vjs-mobile-controls');
        }

        // Enable touch overlay if specified
        if (enableTouchOverlay) {
          player.addClass('vjs-touch-enabled');
        }
      });
    }

    // Event listeners
    player.ready(() => {
      setIsLoading(false);
      setError(null);
      onReady?.(player);
    });

    player.on('play', () => {
      setShowThumbnail(false);
      setHasStartedPlaying(true);
      onPlay?.();
    });

    player.on('pause', () => {
      onPause?.();
    });

    player.on('ended', () => {
      onEnded?.();
    });

    player.on('timeupdate', () => {
      const currentTime = player.currentTime() || 0;
      const duration = player.duration() || 0;
      onTimeUpdate?.(currentTime, duration);
    });

    player.on('error', () => {
      const errorData = player.error();
      console.error('Video player error:', errorData);
      setError(errorData?.message || 'Error loading video');
      setIsLoading(false);
      onError?.(errorData);
    });

    player.on('loadstart', () => {
      setIsLoading(true);
    });

    player.on('loadedmetadata', () => {
      setIsLoading(false);
    });

    // Hotkeys for desktop
    if (enableHotkeys && !isMobile) {
      player.on('keydown', (event: any) => {
        switch (event.which) {
          case 32: // Spacebar - play/pause
            event.preventDefault();
            if (player.paused()) {
              player.play();
            } else {
              player.pause();
            }
            break;
          case 37: // Left arrow - seek backward 10s
            event.preventDefault();
            player.currentTime(Math.max(0, (player.currentTime() || 0) - 10));
            break;
          case 39: // Right arrow - seek forward 10s
            event.preventDefault();
            const duration = player.duration() || 0;
            player.currentTime(Math.min(duration, (player.currentTime() || 0) + 10));
            break;
          case 38: // Up arrow - volume up
            event.preventDefault();
            player.volume(Math.min(1, (player.volume() || 0) + 0.1));
            break;
          case 40: // Down arrow - volume down
            event.preventDefault();
            player.volume(Math.max(0, (player.volume() || 0) - 0.1));
            break;
          case 70: // F key - fullscreen
            event.preventDefault();
            if (player.isFullscreen()) {
              player.exitFullscreen();
            } else {
              player.requestFullscreen();
            }
            break;
          case 77: // M key - mute
            event.preventDefault();
            player.muted(!player.muted());
            break;
        }
      });
    }

    playerRef.current = player;

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster, thumbnailUrl, isMobile]);

  // Get video MIME type
  const getVideoType = (url: string): string => {
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'ogg':
        return 'video/ogg';
      case 'm3u8':
        return 'application/x-mpegURL';
      case 'mpd':
        return 'application/dash+xml';
      default:
        return 'video/mp4';
    }
  };

  // Handle thumbnail click
  const handleThumbnailClick = useCallback(() => {
    if (playerRef.current && showThumbnail) {
      setShowThumbnail(false);
      playerRef.current.play();
    }
  }, [showThumbnail]);

  // Render loading state
  if (isLoading && !hasStartedPlaying) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>Cargando video...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <p className={styles.errorText}>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => {
              setError(null);
              setIsLoading(true);
              if (playerRef.current) {
                playerRef.current.src(src);
              }
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {/* Custom thumbnail overlay */}
      {showThumbnail && (poster || thumbnailUrl) && (
        <div className={styles.thumbnailOverlay} onClick={handleThumbnailClick}>
          <img 
            src={poster || thumbnailUrl} 
            alt={title}
            className={styles.thumbnailImage}
          />
          <div className={styles.playButtonOverlay}>
            <div className={styles.playButton}>
              <svg viewBox="0 0 24 24" className={styles.playIcon}>
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </div>
          </div>
          <div className={styles.thumbnailTitle}>
            <h3>{title}</h3>
          </div>
        </div>
      )}

      {/* Video player container */}
      <div 
        ref={videoRef} 
        className={`${styles.videoContainer} ${isMobile ? styles.mobile : styles.desktop}`}
        data-vjs-player
      />

      {/* Loading overlay during playback */}
      {isLoading && hasStartedPlaying && (
        <div className={styles.playbackLoadingOverlay}>
          <div className={styles.loadingSpinner} />
        </div>
      )}
    </div>
  );
};

export default OptimizedVideoPlayer; 