import React from 'react';
import styles from '../../styles/EmptyState.module.css';

type EmptyStateVariant = 
  | 'no-data' 
  | 'no-courses' 
  | 'no-videos' 
  | 'no-students' 
  | 'no-results' 
  | 'error'
  | 'no-notifications'
  | 'no-schools';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

const illustrations: Record<EmptyStateVariant, React.ReactNode> = {
  'no-data': (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#FEF3C7" />
      <rect x="60" y="70" width="80" height="60" rx="8" fill="#FBBF24" />
      <rect x="70" y="85" width="30" height="6" rx="3" fill="#FEF3C7" />
      <rect x="70" y="97" width="50" height="6" rx="3" fill="#FEF3C7" />
      <rect x="70" y="109" width="40" height="6" rx="3" fill="#FEF3C7" />
      <circle cx="150" cy="60" r="20" fill="#F59E0B" opacity="0.3" />
      <circle cx="50" cy="140" r="15" fill="#F59E0B" opacity="0.2" />
    </svg>
  ),
  'no-courses': (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#FEF3C7" />
      <path d="M60 80L100 60L140 80V130L100 150L60 130V80Z" fill="#FBBF24" />
      <path d="M100 60V150" stroke="#FEF3C7" strokeWidth="2" />
      <path d="M60 80L100 100L140 80" stroke="#FEF3C7" strokeWidth="2" />
      <circle cx="100" cy="100" r="15" fill="#F59E0B" />
      <path d="M95 100L99 104L105 96" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'no-videos': (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#FEF3C7" />
      <rect x="55" y="65" width="90" height="60" rx="10" fill="#FBBF24" />
      <circle cx="100" cy="95" r="20" fill="#F59E0B" />
      <path d="M95 88L110 95L95 102V88Z" fill="white" />
      <rect x="55" y="135" width="90" height="8" rx="4" fill="#FDE68A" />
    </svg>
  ),
  'no-students': (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#FEF3C7" />
      <circle cx="80" cy="85" r="20" fill="#FBBF24" />
      <circle cx="120" cy="85" r="20" fill="#F59E0B" />
      <path d="M60 130C60 115 75 105 100 105C125 105 140 115 140 130V140H60V130Z" fill="#FBBF24" />
      <circle cx="80" cy="85" r="8" fill="#FEF3C7" />
      <circle cx="120" cy="85" r="8" fill="#FEF3C7" />
    </svg>
  ),
  'no-results': (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#FEF3C7" />
      <circle cx="90" cy="90" r="35" stroke="#FBBF24" strokeWidth="8" fill="none" />
      <line x1="115" y1="115" x2="145" y2="145" stroke="#FBBF24" strokeWidth="8" strokeLinecap="round" />
      <line x1="75" y1="80" x2="105" y2="80" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
      <line x1="75" y1="95" x2="95" y2="95" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
  'error': (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#FEE2E2" />
      <circle cx="100" cy="100" r="40" fill="#EF4444" />
      <path d="M100 75V105" stroke="white" strokeWidth="6" strokeLinecap="round" />
      <circle cx="100" cy="120" r="4" fill="white" />
    </svg>
  ),
  'no-notifications': (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#FEF3C7" />
      <path d="M100 60C82 60 68 74 68 92V110L58 125H142L132 110V92C132 74 118 60 100 60Z" fill="#FBBF24" />
      <circle cx="100" cy="140" r="12" fill="#F59E0B" />
      <circle cx="130" cy="70" r="15" fill="#FDE68A" />
      <path d="M125 70H135M130 65V75" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  'no-schools': (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" fill="#FEF3C7" />
      <rect x="55" y="80" width="90" height="60" rx="5" fill="#FBBF24" />
      <path d="M100 50L140 80H60L100 50Z" fill="#F59E0B" />
      <rect x="70" y="95" width="20" height="25" fill="#FEF3C7" />
      <rect x="110" y="95" width="20" height="25" fill="#FEF3C7" />
      <rect x="90" y="110" width="20" height="30" fill="#FDE68A" />
    </svg>
  ),
};

const defaultContent: Record<EmptyStateVariant, { title: string; description: string }> = {
  'no-data': {
    title: 'Sin datos disponibles',
    description: 'Aún no hay información para mostrar aquí.',
  },
  'no-courses': {
    title: 'Sin cursos',
    description: 'No tienes cursos asignados todavía. Explora el catálogo para comenzar.',
  },
  'no-videos': {
    title: 'Sin videos',
    description: 'No hay videos disponibles en este momento.',
  },
  'no-students': {
    title: 'Sin estudiantes',
    description: 'No hay estudiantes registrados en este curso aún.',
  },
  'no-results': {
    title: 'Sin resultados',
    description: 'No encontramos resultados para tu búsqueda. Intenta con otros términos.',
  },
  'error': {
    title: 'Algo salió mal',
    description: 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
  },
  'no-notifications': {
    title: 'Sin notificaciones',
    description: 'No tienes notificaciones nuevas. ¡Estás al día!',
  },
  'no-schools': {
    title: 'Sin escuelas',
    description: 'No hay escuelas disponibles en este momento.',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'no-data',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => {
  const content = defaultContent[variant];

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.illustration}>
        {illustrations[variant]}
      </div>
      <h3 className={styles.title}>{title || content.title}</h3>
      <p className={styles.description}>{description || content.description}</p>
      {(actionLabel || secondaryActionLabel) && (
        <div className={styles.actions}>
          {actionLabel && onAction && (
            <button className={styles.primaryAction} onClick={onAction}>
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button className={styles.secondaryAction} onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;


