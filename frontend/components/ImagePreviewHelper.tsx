import React from 'react';
import styles from '../styles/ImagePreviewHelper.module.css';

interface ImagePreviewHelperProps {
  imageUrl: string;
  title?: string;
}

const ImagePreviewHelper: React.FC<ImagePreviewHelperProps> = ({
  imageUrl,
  title = "Vista previa de la imagen"
}) => {
  return (
    <div className={styles.container}>
      <h4 className={styles.title}>{title}</h4>
      
      <div className={styles.previewGrid}>
        {/* Original image */}
        <div className={styles.previewItem}>
          <h5>Imagen original</h5>
          <div className={styles.originalContainer}>
            <img src={imageUrl} alt="Imagen original" />
          </div>
        </div>

        {/* Course card preview */}
        <div className={styles.previewItem}>
          <h5>En tarjetas de curso</h5>
          <div className={styles.cardPreview}>
            <div className={styles.cardImage}>
              <img src={imageUrl} alt="Vista en tarjeta" />
            </div>
            <div className={styles.cardContent}>
              <h6>Título del Curso</h6>
              <p>Descripción del curso...</p>
            </div>
          </div>
        </div>

        {/* Course header preview */}
        <div className={styles.previewItem}>
          <h5>En página del curso</h5>
          <div className={styles.headerPreview}>
            <img src={imageUrl} alt="Vista en header" />
          </div>
        </div>
      </div>

      <div className={styles.tips}>
        <h5>💡 Consejos para mejores resultados:</h5>
        <ul>
          <li><strong>Aspecto recomendado:</strong> Usa imágenes horizontales (16:9 o 4:3)</li>
          <li><strong>Elementos importantes:</strong> Coloca el contenido principal en el centro</li>
          <li><strong>Texto en imagen:</strong> Evita texto pequeño que pueda ser difícil de leer</li>
          <li><strong>Resolución:</strong> Mínimo 800x450 píxeles para mejor calidad</li>
          <li><strong>Formato:</strong> JPG o PNG funcionan mejor</li>
        </ul>
      </div>
    </div>
  );
};

export default ImagePreviewHelper; 