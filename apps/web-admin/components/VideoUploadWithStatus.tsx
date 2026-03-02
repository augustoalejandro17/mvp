import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../styles/VideoUpload.module.css';

interface VideoUploadWithStatusProps {
  classId: string;
  schoolId: string;
  onUploadComplete?: (videoUrl: string) => void;
  onStatusChange?: (status: string) => void;
}

type VideoStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR';

interface VideoStatusResponse {
  classId: string;
  videoStatus: VideoStatus;
  videoUrl?: string;
  videoProcessingError?: string;
}

const VideoUploadWithStatus: React.FC<VideoUploadWithStatusProps> = ({
  classId,
  schoolId,
  onUploadComplete,
  onStatusChange
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Poll for video status updates
  const checkVideoStatus = useCallback(async () => {
    try {
      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const response = await axios.get<VideoStatusResponse>(
        `${apiUrl}/api/videos/status?classId=${classId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const status = response.data.videoStatus;
      setVideoStatus(status);
      
      if (onStatusChange) {
        onStatusChange(status);
      }

      switch (status) {
        case 'UPLOADING':
          setStatusMessage('Subiendo video...');
          break;
        case 'PROCESSING':
          setStatusMessage('Procesando video con FFmpeg...');
          break;
        case 'READY':
          setStatusMessage('¡Video listo para reproducir!');
          if (response.data.videoUrl && onUploadComplete) {
            onUploadComplete(response.data.videoUrl);
          }
          // Stop polling when ready
          if (statusCheckInterval.current) {
            clearInterval(statusCheckInterval.current);
            statusCheckInterval.current = null;
          }
          break;
        case 'ERROR':
          setStatusMessage(`Error: ${response.data.videoProcessingError || 'Error desconocido'}`);
          setError(response.data.videoProcessingError || 'Error en el procesamiento');
          // Stop polling on error
          if (statusCheckInterval.current) {
            clearInterval(statusCheckInterval.current);
            statusCheckInterval.current = null;
          }
          break;
      }
    } catch (error) {
      console.error('Error checking video status:', error);
    }
  }, [classId, onStatusChange, onUploadComplete]);

  // Start status polling
  const startStatusPolling = useCallback(() => {
    if (statusCheckInterval.current) {
      clearInterval(statusCheckInterval.current);
    }
    
    statusCheckInterval.current = setInterval(checkVideoStatus, 3000); // Check every 3 seconds
  }, [checkVideoStatus]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Por favor selecciona un archivo de video válido');
      return;
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setError('El archivo es demasiado grande. Máximo 100MB permitido');
      return;
    }

    setSelectedFile(file);
    setError('');
  };

  const uploadToS3 = async (presignedUrl: string, file: File) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setError('');
      setUploadProgress(0);
      setVideoStatus('UPLOADING');
      setStatusMessage('Obteniendo URL de subida...');

      const token = Cookies.get('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // Get presigned upload URL
      const presignedResponse = await axios.post(
        `${apiUrl}/api/videos/presigned-upload-url`,
        {
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          schoolId,
          classId
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const { uploadUrl } = presignedResponse.data;
      
      setStatusMessage('Subiendo video...');
      
      // Upload directly to S3
      await uploadToS3(uploadUrl, selectedFile);
      
      setStatusMessage('Video subido. Iniciando procesamiento...');
      setUploadProgress(100);
      
      // Start polling for status updates
      startStatusPolling();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || 'Error al subir el video');
      setVideoStatus('ERROR');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (status: VideoStatus | null) => {
    switch (status) {
      case 'UPLOADING':
        return '#007bff';
      case 'PROCESSING':
        return '#ffc107';
      case 'READY':
        return '#28a745';
      case 'ERROR':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusIcon = (status: VideoStatus | null) => {
    switch (status) {
      case 'UPLOADING':
        return '⬆️';
      case 'PROCESSING':
        return '⚙️';
      case 'READY':
        return '✅';
      case 'ERROR':
        return '❌';
      default:
        return '📹';
    }
  };

  return (
    <div className={styles.videoUploadContainer}>
      <div className={styles.uploadSection}>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          disabled={isUploading || videoStatus === 'PROCESSING'}
          className={styles.fileInput}
        />
        
        {selectedFile && (
          <div className={styles.fileInfo}>
            <p><strong>Archivo seleccionado:</strong> {selectedFile.name}</p>
            <p><strong>Tamaño:</strong> {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || videoStatus === 'PROCESSING'}
          className={styles.uploadButton}
        >
          {isUploading ? 'Subiendo...' : 'Subir Video'}
        </button>
      </div>

      {(videoStatus || isUploading) && (
        <div className={styles.statusSection}>
          <div 
            className={styles.statusIndicator}
            style={{ backgroundColor: getStatusColor(videoStatus) }}
          >
            <span className={styles.statusIcon}>{getStatusIcon(videoStatus)}</span>
            <span className={styles.statusText}>{statusMessage}</span>
          </div>

          {isUploading && uploadProgress > 0 && (
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${uploadProgress}%` }}
              />
              <span className={styles.progressText}>{uploadProgress}%</span>
            </div>
          )}

          {videoStatus === 'PROCESSING' && (
            <div className={styles.processingInfo}>
              <p>🎬 El video se está procesando con FFmpeg</p>
              <p>📏 Escalando a 720p y optimizando para web</p>
              <p>⏱️ Esto puede tomar unos minutos...</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          <span>❌ {error}</span>
        </div>
      )}
    </div>
  );
};

export default VideoUploadWithStatus; 