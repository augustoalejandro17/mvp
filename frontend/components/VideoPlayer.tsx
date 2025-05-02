import React, { useState, useRef } from 'react';
import styles from '../styles/VideoPlayer.module.css';
import api from '../utils/api-client';

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
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video player attributes
  const videoAttrs = {
    ref: videoRef,
    src: url,
    controls: true,
    autoPlay: false,
    className: styles.video,
    poster: '/video-poster.jpg',
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onEnded: () => setIsPlaying(false),
    onError: () => {
      console.error('Error playing video');
      setIsPlaying(false);
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

  if (!url) {
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