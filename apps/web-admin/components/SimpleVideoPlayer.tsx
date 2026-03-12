import React, { useRef, useEffect, useState } from 'react';
import styles from '../styles/SimpleVideoPlayer.module.css';

interface SimpleVideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: any) => void;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  crossOrigin?: 'anonymous' | 'use-credentials';
}

const SimpleVideoPlayer: React.FC<SimpleVideoPlayerProps> = ({
  src,
  poster,
  title = 'Video Player',
  className = '',
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onError,
  autoplay = false,
  muted = false,
  controls = true,
  preload = 'metadata',
  crossOrigin = 'anonymous'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) {
      console.log('SimpleVideo: Missing video element or src', { hasVideo: !!video, src });
      setError('Video source not available');
      return;
    }

    console.log('SimpleVideo: Setting up video with src:', src);
    setDebugInfo(`Loading: ${src}`);

    // Set video source
    video.src = src;

    // Event listeners
    const handleLoadStart = () => {
      console.log('SimpleVideo: Load start');
      setIsLoading(true);
      setError(null);
      setDebugInfo('Loading started');
    };

    const handleLoadedMetadata = () => {
      console.log('SimpleVideo: Loaded metadata');
      setIsLoading(false);
      setDebugInfo('Metadata loaded');
    };

    const handleCanPlay = () => {
      console.log('SimpleVideo: Can play');
      setIsLoading(false);
      setDebugInfo('Ready to play');
    };

    const handlePlay = () => {
      console.log('SimpleVideo: Play event');
      setDebugInfo('Playing');
      onPlay?.();
    };

    const handlePause = () => {
      console.log('SimpleVideo: Pause event');
      setDebugInfo('Paused');
      onPause?.();
    };

    const handleEnded = () => {
      console.log('SimpleVideo: Ended event');
      setDebugInfo('Ended');
      onEnded?.();
    };

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      const duration = video.duration;
      if (duration > 0) {
        onTimeUpdate?.(currentTime, duration);
      }
    };

    const handleError = () => {
      console.error('SimpleVideo: Error event');
      setError('Error loading video');
      setIsLoading(false);
      setDebugInfo('Error loading video');
      onError?.('Error loading video');
    };

    // Mobile touch controls
    let lastTap = 0;
    let tapTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      
      if (tapLength < 500 && tapLength > 0) {
        // Double tap detected - toggle fullscreen
        if (tapTimeout) {
          clearTimeout(tapTimeout);
          tapTimeout = null;
        }
        
        console.log('SimpleVideo Mobile: Double tap - toggling fullscreen');
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          video.requestFullscreen().catch(console.log);
        }
      } else {
        // Single tap - toggle play/pause after delay to check for double tap
        tapTimeout = setTimeout(() => {
          console.log('SimpleVideo Mobile: Single tap - toggling play/pause');
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          tapTimeout = null;
        }, 300);
      }
      
      lastTap = currentTime;
    };

    const handleClick = (e: Event) => {
      // Only prevent default click on mobile to avoid conflicts with touch events
      const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        e.preventDefault();
      }
    };

    // Add event listeners
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleError);
    
    // Add mobile touch controls
    video.addEventListener('touchend', handleTouchEnd);
    video.addEventListener('click', handleClick);

    // Cleanup function
    return () => {
      if (tapTimeout) {
        clearTimeout(tapTimeout);
      }
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleError);
      video.removeEventListener('touchend', handleTouchEnd);
      video.removeEventListener('click', handleClick);
    };
  }, [src, onPlay, onPause, onEnded, onTimeUpdate, onError]);

  // Render loading state
  if (isLoading && !error) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner} />
          <p className={styles.loadingText}>Cargando video...</p>
          {debugInfo && <p className={styles.debugText}>{debugInfo}</p>}
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
          {debugInfo && <p className={styles.debugText}>{debugInfo}</p>}
          <button 
            className={styles.retryButton}
            onClick={() => {
              console.log('SimpleVideo: Retry button clicked');
              setError(null);
              setIsLoading(true);
              if (videoRef.current) {
                videoRef.current.load();
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
      <video
        ref={videoRef}
        className={styles.video}
        controls={controls}
        autoPlay={autoplay}
        muted={muted}
        preload={preload}
        crossOrigin={crossOrigin}
        poster={poster}
        playsInline
        title={title}
      />
      {debugInfo && (
        <div className={styles.debugInfo}>
          <small>{debugInfo}</small>
        </div>
      )}
    </div>
  );
};

export default SimpleVideoPlayer; 
