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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDownload = async () => {
    if (!classId) return;
    
    setIsDownloading(true);
    setDownloadError(null);
    
    try {
      // Get download URL from the API
      const response = await api.get(`/classes/${classId}/download-url`);
      const { url: downloadUrl, filename } = response.data;
      
      // Create a link element
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename || `${title || 'class-video'}.mp4`);
      
      // Append to html link element page
      document.body.appendChild(link);
      
      // Start download
      link.click();
      
      // Clean up and remove the link
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      setDownloadError('Failed to download the video. Please try again later.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!url) {
    return (
      <div className={styles.container}>
        <div className={styles.noVideo}>No video available for this class.</div>
      </div>
    );
  }

  // Usar atributos específicos para prevenir problemas de orientación
  const videoAttrs = {
    className: styles.videoFrame,
    playsInline: true,
    controls: true,
    preload: "auto",
    title: title || 'Class Video',
    ref: videoRef,
    src: url,
    // Forzar orientación correcta
    style: {
      transform: 'rotate(0deg)',
      WebkitTransform: 'rotate(0deg)',
      MozTransform: 'rotate(0deg)',
      msTransform: 'rotate(0deg)',
      OTransform: 'rotate(0deg)',
    }
  };

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