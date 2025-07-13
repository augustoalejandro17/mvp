import React, { useState, useEffect, useRef, useCallback } from 'react';
import OptimizedVideoPlayer from './OptimizedVideoPlayer';
import styles from '../styles/LazyVideoLoader.module.css';

interface LazyVideoLoaderProps {
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
  preloadDistance?: number; // Distance in pixels to start preloading
  enableBandwidthDetection?: boolean;
  fallbackPoster?: string;
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

interface NetworkInfo {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

const LazyVideoLoader: React.FC<LazyVideoLoaderProps> = ({
  src,
  poster,
  title = 'Video',
  className = '',
  onReady,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onError,
  preloadDistance = 200,
  enableBandwidthDetection = true,
  fallbackPoster,
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
  const [isInView, setIsInView] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({});
  const [optimizedSrc, setOptimizedSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Detect network conditions
  useEffect(() => {
    if (!enableBandwidthDetection) return;

    const updateNetworkInfo = () => {
      const nav = navigator as any;
      if (nav.connection) {
        setNetworkInfo({
          effectiveType: nav.connection.effectiveType,
          downlink: nav.connection.downlink,
          rtt: nav.connection.rtt,
          saveData: nav.connection.saveData
        });
      }
    };

    updateNetworkInfo();

    const nav = navigator as any;
    if (nav.connection) {
      nav.connection.addEventListener('change', updateNetworkInfo);
      return () => nav.connection.removeEventListener('change', updateNetworkInfo);
    }
  }, [enableBandwidthDetection]);

  // Optimize video source based on network conditions
  useEffect(() => {
    if (!enableBandwidthDetection || !networkInfo.effectiveType) {
      setOptimizedSrc(src);
      return;
    }

    // Adjust video quality based on network speed
    const getOptimizedSrc = (originalSrc: string, networkType: string, saveData?: boolean): string => {
      // If user has data saver enabled, use lowest quality
      if (saveData) {
        return originalSrc.replace(/\.(mp4|webm)$/, '_low.$1');
      }

      switch (networkType) {
        case 'slow-2g':
        case '2g':
          return originalSrc.replace(/\.(mp4|webm)$/, '_low.$1');
        case '3g':
          return originalSrc.replace(/\.(mp4|webm)$/, '_medium.$1');
        case '4g':
        default:
          return originalSrc; // Use original quality
      }
    };

    setOptimizedSrc(getOptimizedSrc(src, networkInfo.effectiveType, networkInfo.saveData));
  }, [src, networkInfo, enableBandwidthDetection]);

  // Set up intersection observer
  useEffect(() => {
    if (!containerRef.current) return;

    const options = {
      root: null,
      rootMargin: `${preloadDistance}px`,
      threshold: 0.1
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          // Start loading when video comes into view
          if (!shouldLoad) {
            setShouldLoad(true);
          }
        } else {
          setIsInView(false);
        }
      });
    }, options);

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [preloadDistance, shouldLoad]);

  // Preload video metadata when approaching viewport
  const handlePreload = useCallback(async () => {
    if (isLoading || !optimizedSrc) return;

    setIsLoading(true);
    setError(null);

    try {
      // Preload video metadata
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.crossOrigin = crossOrigin;
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        video.src = optimizedSrc;
      });

      console.log('Video metadata preloaded successfully');
    } catch (err) {
      console.warn('Failed to preload video metadata:', err);
      setError('Failed to preload video');
    } finally {
      setIsLoading(false);
    }
  }, [optimizedSrc, crossOrigin, isLoading]);

  // Start preloading when video enters the preload zone
  useEffect(() => {
    if (isInView && !shouldLoad) {
      handlePreload();
    }
  }, [isInView, shouldLoad, handlePreload]);

  // Generate thumbnail from video if no poster provided
  const generateThumbnail = useCallback(async (videoSrc: string): Promise<string | null> => {
    try {
      const video = document.createElement('video');
      video.crossOrigin = crossOrigin;
      video.muted = true;
      
      return new Promise((resolve) => {
        video.onloadeddata = () => {
          video.currentTime = Math.min(5, video.duration / 4); // Seek to 25% or 5 seconds
        };
        
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            resolve(null);
          }
        };
        
        video.onerror = () => resolve(null);
        video.src = videoSrc;
      });
    } catch {
      return null;
    }
  }, [crossOrigin]);

  // Auto-generate thumbnail if needed
  useEffect(() => {
    if (!poster && !thumbnailUrl && shouldLoad && optimizedSrc) {
      generateThumbnail(optimizedSrc).then((thumbnail) => {
        if (thumbnail) {
          // Update thumbnail state if component supports it
          console.log('Generated thumbnail for video');
        }
      });
    }
  }, [poster, thumbnailUrl, shouldLoad, optimizedSrc, generateThumbnail]);

  // Render placeholder while not loaded
  if (!shouldLoad) {
    return (
      <div 
        ref={containerRef}
        className={`${styles.placeholder} ${className}`}
        style={{ aspectRatio: aspectRatio.replace(':', '/') }}
      >
        <div className={styles.placeholderContent}>
          {(poster || thumbnailUrl || fallbackPoster) && (
            <img 
              src={poster || thumbnailUrl || fallbackPoster}
              alt={title}
              className={styles.placeholderImage}
              loading="lazy"
            />
          )}
          
          <div className={styles.placeholderOverlay}>
            <div className={styles.loadingIndicator}>
              {isLoading ? (
                <div className={styles.loadingSpinner} />
              ) : (
                <div className={styles.playButton}>
                  <svg viewBox="0 0 24 24" className={styles.playIcon}>
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className={styles.videoInfo}>
              <h3 className={styles.videoTitle}>{title}</h3>
              {networkInfo.effectiveType && (
                <p className={styles.networkInfo}>
                  Optimizado para {networkInfo.effectiveType.toUpperCase()}
                  {networkInfo.saveData && ' (Ahorro de datos)'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div 
        ref={containerRef}
        className={`${styles.errorContainer} ${className}`}
      >
        <div className={styles.errorContent}>
          <div className={styles.errorIcon}>⚠️</div>
          <p className={styles.errorText}>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => {
              setError(null);
              setShouldLoad(false);
              setTimeout(() => setShouldLoad(true), 100);
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Render optimized video player
  return (
    <div ref={containerRef} className={className}>
      <OptimizedVideoPlayer
        src={optimizedSrc}
        poster={poster || thumbnailUrl}
        title={title}
        onReady={onReady}
        onPlay={onPlay}
        onPause={onPause}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        onError={onError}
        autoplay={autoplay && isInView} // Only autoplay if in view
        muted={muted}
        controls={controls}
        fluid={fluid}
        responsive={responsive}
        aspectRatio={aspectRatio}
        playbackRates={playbackRates}
        preload={isInView ? preload : 'none'} // Only preload if in view
        crossOrigin={crossOrigin}
        enableHotkeys={enableHotkeys}
        enableTouchOverlay={enableTouchOverlay}
        thumbnailUrl={thumbnailUrl}
      />
    </div>
  );
};

export default LazyVideoLoader; 