import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/ImageCropPreview.module.css';

interface ImageCropPreviewProps {
  imageUrl: string;
  aspectRatio?: number; // width/height ratio for the crop area
  onPositionChange?: (position: { x: number; y: number; scale: number }) => void;
  title?: string;
}

const ImageCropPreview: React.FC<ImageCropPreviewProps> = ({
  imageUrl,
  aspectRatio = 16 / 9, // Default aspect ratio for course cards
  onPositionChange,
  title = "Vista previa del recorte"
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (onPositionChange) {
      onPositionChange({ x: position.x, y: position.y, scale });
    }
  }, [position, scale, onPositionChange]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      const img = imageRef.current;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      
      // Auto-fit the image to show the full image initially
      const container = containerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        const imageAspect = img.naturalWidth / img.naturalHeight;
        const containerAspect = containerWidth / containerHeight;
        
        if (imageAspect > containerAspect) {
          // Image is wider than container
          setScale(containerHeight / img.naturalHeight);
        } else {
          // Image is taller than container
          setScale(containerWidth / img.naturalWidth);
        }
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScale(parseFloat(e.target.value));
  };

  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
    setScale(1);
  };

  return (
    <div className={styles.container}>
      <h4 className={styles.title}>{title}</h4>
      
      <div className={styles.previewContainer}>
        {/* Original image preview */}
        <div className={styles.originalPreview}>
          <h5>Imagen completa</h5>
          <div className={styles.originalImageContainer}>
            <img src={imageUrl} alt="Imagen original" />
          </div>
        </div>

        {/* Crop preview */}
        <div className={styles.cropPreview}>
          <h5>Como se verá en las tarjetas</h5>
          <div 
            ref={containerRef}
            className={styles.cropContainer}
            style={{ aspectRatio }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Vista previa del recorte"
              className={styles.cropImage}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
              onLoad={handleImageLoad}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label htmlFor="scale">Tamaño de la imagen:</label>
          <input
            id="scale"
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={scale}
            onChange={handleScaleChange}
            className={styles.scaleSlider}
          />
          <span className={styles.scaleValue}>{Math.round(scale * 100)}%</span>
        </div>
        
        <button 
          onClick={resetPosition}
          className={styles.resetButton}
          type="button"
        >
          Restablecer posición
        </button>
      </div>

      <p className={styles.instructions}>
        💡 Arrastra la imagen para moverla y usa el control deslizante para cambiar el tamaño. 
        La vista previa muestra cómo se verá en las tarjetas de curso.
      </p>
    </div>
  );
};

export default ImageCropPreview; 