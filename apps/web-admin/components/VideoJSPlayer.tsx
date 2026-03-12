import React, { useRef, useEffect, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/themes/dist/forest/index.css';
import styles from '../styles/VideoJSPlayer.module.css';

interface VideoJSPlayerProps {
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

const VideoJSPlayer: React.FC<VideoJSPlayerProps> = ({
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
  fluid = false,
  responsive = false,
  aspectRatio = '16:9',
  playbackRates = [0.5, 1, 1.25, 1.5, 2],
  preload = 'metadata',
  crossOrigin = 'anonymous',
  enableHotkeys = false,
  enableTouchOverlay = false,
  thumbnailUrl
}) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize Video.js player
  useEffect(() => {
    if (!videoRef.current || !src) {
      console.log('VideoJS: Missing container or src', { hasContainer: !!videoRef.current, src });
      setError('Video source not available');
      return;
    }

    console.log('VideoJS: Initializing player with src:', src);
    setDebugInfo(`Initializing with src: ${src}`);

    // Cleanup previous player
    if (playerRef.current) {
      try {
        console.log('VideoJS: Disposing previous player');
        playerRef.current.dispose();
      } catch (e) {
        console.warn('Error disposing previous player:', e);
      }
      playerRef.current = null;
    }

    // Create video element
    const videoElement = document.createElement('video-js');
    videoElement.className = 'video-js vjs-theme-forest';
    videoElement.setAttribute('controls', '');
    videoElement.setAttribute('preload', preload);
    videoElement.setAttribute('data-setup', '{}');
    videoElement.setAttribute('playsinline', '');
    
    if (poster || thumbnailUrl) {
      videoElement.setAttribute('poster', poster || thumbnailUrl || '');
    }

    // Clear container and append video element
    videoRef.current.innerHTML = '';
    videoRef.current.appendChild(videoElement);

    // Enhanced Video.js options for proxy URLs
    const options: any = {
      controls,
      fluid,
      responsive,
      aspectRatio,
      preload,
      poster: poster || thumbnailUrl,
      muted,
      autoplay: autoplay && !isMobile,
      crossOrigin,
      playbackRates,
      // Control bar configuration
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'progressControl',
          'durationDisplay',
          'playbackRateMenuButton',
          'fullscreenToggle'
        ],
        volumePanel: {
          inline: false,
          vertical: false
        }
      },
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
      // Enhanced network settings for proxy URLs
      ...(isMobile && {
        playsinline: true,
        disablePictureInPicture: false,
        enableSmoothSeeking: true,
        experimentalSvgIcons: true
      })
    };

    // Initialize player
    const player = videojs(videoElement, options);

    // Enhanced error handling for proxy URLs
    player.ready(() => {
      console.log('VideoJS: Player ready');
      setDebugInfo('Player ready');
      setIsLoading(false);
      onReady?.(player);

      // Configure for mobile
      if (isMobile) {
        player.addClass('vjs-mobile');
        
        const controlBar = player.getChild('ControlBar');
        if (controlBar) {
          controlBar.addClass('vjs-mobile-controls');
        }

        if (enableTouchOverlay) {
          player.addClass('vjs-touch-enabled');
        }

        // Mobile-specific enhancements
        setupMobileControls(player);
      }

      // Enhanced keyboard shortcuts
      if (enableHotkeys) {
        player.on('keydown', (event: any) => {
          const keyEvent = event.which || event.keyCode;
          
          switch (keyEvent) {
            case 32: // Spacebar
              event.preventDefault();
              if (player.paused()) {
                player.play();
              } else {
                player.pause();
              }
              break;
            case 37: // Left arrow
              event.preventDefault();
              const currentTime = player.currentTime();
              if (typeof currentTime === 'number') {
                player.currentTime(Math.max(0, currentTime - 10));
              }
              break;
            case 39: // Right arrow
              event.preventDefault();
              const currentTimeForward = player.currentTime();
              const duration = player.duration();
              if (typeof currentTimeForward === 'number' && typeof duration === 'number') {
                player.currentTime(Math.min(duration, currentTimeForward + 10));
              }
              break;
            case 70: // F key
              event.preventDefault();
              if (player.isFullscreen()) {
                player.exitFullscreen();
              } else {
                player.requestFullscreen();
              }
              break;
            case 77: // M key
              event.preventDefault();
              player.muted(!player.muted());
              break;
          }
        });
      }
    });

    // Enhanced event handlers
    player.on('loadstart', () => {
      console.log('VideoJS: Load start');
      setDebugInfo('Loading started');
      setIsLoading(true);
      setError(null);
    });

    player.on('loadedmetadata', () => {
      console.log('VideoJS: Loaded metadata');
      setDebugInfo('Metadata loaded');
      setIsLoading(false);
    });

    player.on('canplay', () => {
      console.log('VideoJS: Can play');
      setDebugInfo('Ready to play');
      setIsLoading(false);
    });

    player.on('play', () => {
      console.log('VideoJS: Play event');
      setDebugInfo('Playing');
      onPlay?.();
    });

    player.on('pause', () => {
      console.log('VideoJS: Pause event');
      setDebugInfo('Paused');
      onPause?.();
    });

    player.on('ended', () => {
      console.log('VideoJS: Ended event');
      setDebugInfo('Ended');
      onEnded?.();
    });

    player.on('timeupdate', () => {
      const currentTime = player.currentTime();
      const duration = player.duration();
      if (typeof currentTime === 'number' && typeof duration === 'number' && duration > 0) {
        onTimeUpdate?.(currentTime, duration);
      }
    });

    // Enhanced error handling for proxy URLs
    player.on('error', () => {
      const error = player.error();
      console.error('VideoJS: Player error:', error);
      
      let errorMessage = 'Video playback error';
      if (error) {
        switch (error.code) {
          case 1:
            errorMessage = 'Video loading aborted';
            break;
          case 2:
            errorMessage = 'Network error while loading video';
            break;
          case 3:
            errorMessage = 'Video decoding error';
            break;
          case 4:
            errorMessage = 'Video format not supported or video source not found';
            break;
          default:
            errorMessage = `Video error (code: ${error.code})`;
        }
      }
      
      setError(errorMessage);
      setDebugInfo(`Error: ${errorMessage}`);
      setIsLoading(false);
      onError?.(error);
    });

    // Handle network errors specifically for proxy URLs
    player.on('networkerror', () => {
      console.error('VideoJS: Network error');
      setError('Network error - video proxy may be unavailable');
      setDebugInfo('Network error');
      setIsLoading(false);
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {
          console.warn('Error disposing player on cleanup:', e);
        }
        playerRef.current = null;
      }
    };
  }, [src, poster, thumbnailUrl, autoplay, muted, controls, fluid, responsive, aspectRatio, preload, crossOrigin, enableHotkeys, enableTouchOverlay, isMobile]);

  // Mobile-specific control setup
  const setupMobileControls = (player: any) => {
    let lastTap = 0;
    let tapTimeout: ReturnType<typeof setTimeout> | null = null;

    // Get the video element for touch events
    const videoElement = player.el().querySelector('video');
    
    if (videoElement) {
      // Touch to pause/play and double-tap to fullscreen
      videoElement.addEventListener('touchend', (e: TouchEvent) => {
        e.preventDefault();
        
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < 500 && tapLength > 0) {
          // Double tap detected - toggle fullscreen
          if (tapTimeout) {
            clearTimeout(tapTimeout);
            tapTimeout = null;
          }
          
          console.log('VideoJS Mobile: Double tap - toggling fullscreen');
          if (player.isFullscreen()) {
            player.exitFullscreen();
          } else {
            player.requestFullscreen();
          }
        } else {
          // Single tap - toggle play/pause after delay to check for double tap
          tapTimeout = setTimeout(() => {
            console.log('VideoJS Mobile: Single tap - toggling play/pause');
            if (player.paused()) {
              player.play();
            } else {
              player.pause();
            }
            tapTimeout = null;
          }, 300);
        }
        
        lastTap = currentTime;
      });

      // Prevent default click behavior to avoid conflicts
      videoElement.addEventListener('click', (e: Event) => {
        e.preventDefault();
      });
    }

    // Simple volume control visibility check
    const ensureVolumeControlsVisible = () => {
      const controlBar = player.getChild('ControlBar');
      if (controlBar) {
        const volumePanel = controlBar.getChild('VolumePanel');
        if (volumePanel) {
          volumePanel.show();
        }
      }
    };

    // Ensure playback rate menu is always available
    const playbackRatesButton = player.getChild('ControlBar')?.getChild('PlaybackRateMenuButton');
    if (playbackRatesButton) {
      playbackRatesButton.show();
    }

    // Handle fullscreen changes to ensure controls remain visible
    player.on('fullscreenchange', () => {
      setTimeout(() => {
        ensureVolumeControlsVisible();
        
        // Ensure playback rate menu remains visible in fullscreen
        const playbackRatesButton = player.getChild('ControlBar')?.getChild('PlaybackRateMenuButton');
        if (playbackRatesButton) {
          playbackRatesButton.show();
        }
      }, 100);
    });

    // Handle user activity to ensure controls remain visible
    player.on('useractive', () => {
      ensureVolumeControlsVisible();
    });
  };

  // Helper function to determine video type
  const getVideoType = (url: string): string => {
    if (url.includes('/video-proxy') || url.includes('/stream-url')) {
      return 'video/mp4'; // Default for proxy URLs
    }
    
    if (url.includes('.webm')) return 'video/webm';
    if (url.includes('.ogg') || url.includes('.ogv')) return 'video/ogg';
    if (url.includes('.mov')) return 'video/quicktime';
    return 'video/mp4'; // Default fallback
  };

  if (error) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className={styles.error}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorMessage}>
            <strong>VideoJS Player Error</strong>
            <p>{error}</p>
          </div>
          <div className={styles.debugInfo}>
            <small>Debug: {debugInfo}</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`}>
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading video...</p>
          <small>{debugInfo}</small>
        </div>
      )}
      <div 
        ref={videoRef} 
        className={styles.videoContainer}
        style={{ display: isLoading ? 'none' : 'block' }}
      />

    </div>
  );
};

export default VideoJSPlayer; 
