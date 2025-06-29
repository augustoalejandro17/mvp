import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../styles/ImageUploader.module.css';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string) => void;
  defaultImage?: string;
  label?: string;
  className?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  defaultImage,
  label = 'Imagen',
  className = '',
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with default image and add cache-busting
  useEffect(() => {
    if (defaultImage) {
      
      // Add cache busting parameter
      const imageUrlWithCache = defaultImage.includes('?') 
        ? `${defaultImage}&t=${Date.now()}` 
        : `${defaultImage}?t=${Date.now()}`;
      setPreviewUrl(imageUrlWithCache);
    }
  }, [defaultImage]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    // Validar tipo de archivo
    if (!file.type.match('image.*')) {
      setUploadError('Por favor, selecciona un archivo de imagen válido (jpeg, png, gif)');
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('La imagen es demasiado grande. El tamaño máximo es 5MB');
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError('');
    
    // Subir imagen automáticamente cuando se selecciona
    uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    setUploadError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const token = Cookies.get('token');

      const formData = new FormData();
      formData.append('image', file);

      const response = await axios.post(
        `${apiUrl}/api/upload/image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data && response.data.imageUrl) {
        
        // Add cache busting parameter to ensure we see the latest version
        const imageUrlWithCache = response.data.imageUrl.includes('?') 
          ? `${response.data.imageUrl}&t=${Date.now()}` 
          : `${response.data.imageUrl}?t=${Date.now()}`;
        setPreviewUrl(imageUrlWithCache);
        onImageUpload(response.data.imageUrl);
      } else {
        setUploadError('Error al procesar la imagen');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      
      if (error.response && error.response.data && error.response.data.message) {
        setUploadError(
          typeof error.response.data.message === 'string' 
            ? error.response.data.message 
            : 'Error al subir la imagen'
        );
      } else {
        setUploadError('Error al subir la imagen. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <label className={styles.label}>{label}</label>
      
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className={styles.fileInput}
        />
        
        {previewUrl ? (
          <div className={styles.preview}>
            <img 
              src={previewUrl} 
              alt="Vista previa" 
              className={styles.previewImage}
              onError={(e) => {
                console.error('Failed to load preview image:', previewUrl);
                // Try one more time with a fresh cache parameter
                const refreshedUrl = previewUrl.split('?')[0] + '?t=' + Date.now();
                
                e.currentTarget.src = refreshedUrl;
              }}
            />
            {isUploading && <div className={styles.uploadingOverlay}>Subiendo...</div>}
          </div>
        ) : (
          <div className={styles.placeholder}>
            {isUploading ? (
              <div className={styles.uploading}>
                <div className={styles.spinner}></div>
                <p>Subiendo imagen...</p>
              </div>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p>Haz clic o arrastra una imagen aquí</p>
                <span className={styles.hint}>JPG, PNG, GIF (máx. 5MB)</span>
              </>
            )}
          </div>
        )}
      </div>
      
      {uploadError && <p className={styles.error}>{uploadError}</p>}
    </div>
  );
};

export default ImageUploader; 