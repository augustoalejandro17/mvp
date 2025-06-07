import React from 'react';
import styles from '../styles/SchoolLogoPreview.module.css';

interface SchoolLogoPreviewProps {
  imageUrl: string;
  schoolName?: string;
  title?: string;
}

const SchoolLogoPreview: React.FC<SchoolLogoPreviewProps> = ({
  imageUrl,
  schoolName = "Tu Escuela",
  title = "Vista previa del logo"
}) => {
  return (
    <div className={styles.container}>
      <h4 className={styles.title}>{title}</h4>
      
      <div className={styles.previewGrid}>
        {/* Original image */}
        <div className={styles.previewItem}>
          <h5>Logo original</h5>
          <div className={styles.originalContainer}>
            <img src={imageUrl} alt="Logo original" />
          </div>
        </div>

        {/* Home page school card preview */}
        <div className={styles.previewItem}>
          <h5>En página principal</h5>
          <div className={styles.homeCardPreview}>
            <div className={styles.schoolLogo}>
              <img src={imageUrl} alt="Logo en página principal" />
            </div>
            <div className={styles.schoolInfo}>
              <h6>{schoolName}</h6>
              <p>¡Tu lugar feliz!</p>
            </div>
          </div>
        </div>

        {/* School header preview */}
        <div className={styles.previewItem}>
          <h5>En página de la escuela</h5>
          <div className={styles.schoolHeaderPreview}>
            <div className={styles.headerLogo}>
              <img src={imageUrl} alt="Logo en header" />
            </div>
            <div className={styles.headerInfo}>
              <h6>{schoolName}</h6>
              <p className={styles.headerSubtitle}>Director: Tu Nombre</p>
            </div>
          </div>
        </div>

        {/* Navigation preview */}
        <div className={styles.previewItem}>
          <h5>En navegación</h5>
          <div className={styles.navPreview}>
            <div className={styles.navLogo}>
              <img src={imageUrl} alt="Logo en navegación" />
            </div>
            <span className={styles.navText}>{schoolName}</span>
          </div>
        </div>
      </div>

      <div className={styles.tips}>
        <h5>💡 Consejos para mejores resultados:</h5>
        <ul>
          <li><strong>Forma recomendada:</strong> Logos cuadrados o redondos funcionan mejor</li>
          <li><strong>Fondo transparente:</strong> Usa PNG con fondo transparente para mejor integración</li>
          <li><strong>Simplicidad:</strong> Logos simples se ven mejor en tamaños pequeños</li>
          <li><strong>Legibilidad:</strong> Asegúrate de que el texto sea legible en diferentes tamaños</li>
          <li><strong>Resolución:</strong> Mínimo 300x300 píxeles para mejor calidad</li>
          <li><strong>Colores:</strong> Usa colores que contrasten bien con fondos claros y oscuros</li>
        </ul>
      </div>
    </div>
  );
};

export default SchoolLogoPreview; 