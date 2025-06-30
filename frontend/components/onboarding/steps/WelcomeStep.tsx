import React from 'react';
import styles from '../../../styles/OnboardingSteps.module.css';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface OnboardingData {
  hasOnboarded: boolean;
  onboardingProgress: any;
  profileCompletion: number;
  userRole: string;
  needsOnboarding: boolean;
}

interface WelcomeStepProps {
  user: User;
  onNext: (step: string, stepData?: Record<string, any>) => void;
  onSkip: (reason?: string) => void;
  isUpdating: boolean;
  onboardingData: OnboardingData;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ 
  user, 
  onNext, 
  onSkip, 
  isUpdating 
}) => {
  const handleGetStarted = () => {
    onNext('welcome', { 
      timestamp: new Date().toISOString(),
      userName: user.name
    });
  };

  const handleSkip = () => {
    onSkip('User chose to skip from welcome screen');
  };

  return (
    <div className={styles.stepContainer}>
      <div className={styles.logoContainer}>
        <div className={styles.logo}>
          <h1>Inti</h1>
        </div>
      </div>
      
      <div className={styles.content}>
        <h2 className={styles.title}>
          ¡Bienvenido{user.name ? `, ${user.name.split(' ')[0]}` : ''}!
        </h2>
        
        <p className={styles.subtitle}>
          Nos alegra tenerte aquí. Te guiaremos a través de una configuración rápida 
          para personalizar tu experiencia educativa.
        </p>
        
        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📚</div>
            <div className={styles.featureText}>
              <h3>Gestiona tu contenido educativo</h3>
              <p>Organiza cursos, clases y materiales de aprendizaje</p>
            </div>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>👥</div>
            <div className={styles.featureText}>
              <h3>Conecta con estudiantes y profesores</h3>
              <p>Colabora y comunica con tu comunidad educativa</p>
            </div>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📊</div>
            <div className={styles.featureText}>
              <h3>Monitorea el progreso</h3>
              <p>Obtén insights sobre el rendimiento y la asistencia</p>
            </div>
          </div>
        </div>
        
        <div className={styles.actions}>
          <button 
            className={styles.primaryButton}
            onClick={handleGetStarted}
            disabled={isUpdating}
          >
            {isUpdating ? 'Iniciando...' : 'Comenzar'}
          </button>
          
          <button 
            className={styles.skipButton}
            onClick={handleSkip}
            disabled={isUpdating}
          >
            Saltar introducción
          </button>
        </div>
        
        <div className={styles.stepInfo}>
          <p>Solo tomará unos minutos configurar tu cuenta</p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeStep; 