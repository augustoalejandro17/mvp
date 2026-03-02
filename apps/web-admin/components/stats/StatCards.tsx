import React from 'react';
import styles from '../../styles/Stats.module.css';

interface StatCardProps {
  title: string;
  value: number | string;
  subtext?: string;
  format?: 'number' | 'currency' | 'percentage' | 'none';
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: number;
  };
}

// Componente para tarjeta de estadu00edstica individual
export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subtext, 
  format = 'none',
  trend
}) => {
  // Formatea el valor segu00fan el tipo especificado
  const formatValue = () => {
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'number':
        return new Intl.NumberFormat('es-AR').format(value);
      case 'currency':
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
      case 'percentage':
        return `${value}%`;
      default:
        return value.toString();
    }
  };

  // Clase para el indicador de tendencia
  const getTrendClass = () => {
    if (!trend) return '';
    
    switch (trend.direction) {
      case 'up':
        return styles.goodIndicator;
      case 'down':
        return styles.badIndicator;
      default:
        return styles.warningIndicator;
    }
  };

  // Texto para la tendencia
  const getTrendText = () => {
    if (!trend) return null;
    
    const prefix = trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : '';
    return `${prefix}${trend.value}%`;
  };

  return (
    <div className={styles.statCard}>
      <h3>{title}</h3>
      <div className={styles.statValue}>{formatValue()}</div>
      {subtext && <div className={styles.statSubtext}>{subtext}</div>}
      {trend && (
        <div className={`${styles.statSubtext} ${getTrendClass()}`}>
          {getTrendText()}
        </div>
      )}
    </div>
  );
};

// Componente que muestra un nu00famero con un gradiente de color segu00fan el valor
interface RateIndicatorProps {
  value: number;
  type: 'retention' | 'attendance' | 'dropout';
  size?: 'small' | 'medium' | 'large';
}

export const RateIndicator: React.FC<RateIndicatorProps> = ({ 
  value, 
  type,
  size = 'medium' 
}) => {
  // Determina el color segu00fan el valor y tipo
  const getIndicatorClass = () => {
    let threshold1, threshold2;
    
    switch (type) {
      case 'retention':
      case 'attendance':
        threshold1 = 70;
        threshold2 = 85;
        break;
      case 'dropout':
        threshold1 = 30;
        threshold2 = 15;
        // Para dropout, menor es mejor (inverso)
        return value > threshold1 ? styles.badIndicator : 
               value > threshold2 ? styles.warningIndicator : 
               styles.goodIndicator;
      default:
        threshold1 = 50;
        threshold2 = 75;
    }
    
    return value < threshold1 ? styles.badIndicator : 
           value < threshold2 ? styles.warningIndicator : 
           styles.goodIndicator;
  };

  // Clase de tamau00f1o
  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'text-sm';
      case 'large':
        return 'text-lg';
      default:
        return 'text-base';
    }
  };

  return (
    <span className={`${getIndicatorClass()} ${getSizeClass()}`}>
      {value}%
    </span>
  );
};

// Grid de tarjetas
interface StatCardGridProps {
  children: React.ReactNode;
}

export const StatCardGrid: React.FC<StatCardGridProps> = ({ children }) => {
  return (
    <div className={styles.statsGrid}>
      {children}
    </div>
  );
}; 