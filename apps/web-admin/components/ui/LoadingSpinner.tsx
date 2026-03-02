import React from 'react';
import styles from '../../styles/LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = '#3182ce' 
}) => {
  return (
    <div className={`${styles.spinner} ${styles[size]}`} style={{ borderTopColor: color }}>
      <span className={styles.srOnly}>Cargando...</span>
    </div>
  );
};

export default LoadingSpinner; 