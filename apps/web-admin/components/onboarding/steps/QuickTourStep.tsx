import React, { useState } from 'react';
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

interface QuickTourStepProps {
  user: User;
  onNext: (step: string, stepData?: Record<string, any>) => void;
  onSkip: (reason?: string) => void;
  isUpdating: boolean;
  onboardingData: OnboardingData;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
  action: string;
}

const QuickTourStep: React.FC<QuickTourStepProps> = ({ 
  user, 
  onNext, 
  onSkip, 
  isUpdating 
}) => {
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);

  const getRoleFeaturesAndActions = (): { features: Feature[], primaryAction: string, secondaryActions: string[] } => {
    switch (user.role) {
      case 'student':
        return {
          features: [
            {
              icon: '📚',
              title: 'Accede a tus cursos',
              description: 'Explora el contenido educativo, materiales de estudio y recursos multimedia.',
              action: 'Ver cursos disponibles'
            },
            {
              icon: '📝',
              title: 'Completa tareas y evaluaciones',
              description: 'Realiza asignaciones, exámenes y recibe retroalimentación instant∏anea.',
              action: 'Ver tareas pendientes'
            },
            {
              icon: '📊',
              title: 'Monitorea tu progreso',
              description: 'Visualiza tu avance, calificaciones y estadísticas de aprendizaje.',
              action: 'Ver mi progreso'
            },
            {
              icon: '💬',
              title: 'Comunícate con profesores',
              description: 'Haz preguntas, participa en discusiones y recibe apoyo personalizado.',
              action: 'Enviar mensaje'
            }
          ],
          primaryAction: 'Explorar mis cursos',
          secondaryActions: ['Ver perfil', 'Configurar notificaciones']
        };

      case 'teacher':
        return {
          features: [
            {
              icon: '🎯',
              title: 'Crea y gestiona cursos',
              description: 'Diseña contenido educativo, organiza módulos y estructura tu plan de estudios.',
              action: 'Crear nuevo curso'
            },
            {
              icon: '📹',
              title: 'Sube contenido multimedia',
              description: 'Comparte videos, documentos, presentaciones y recursos interactivos.',
              action: 'Subir video'
            },
            {
              icon: '👥',
              title: 'Gestiona estudiantes',
              description: 'Supervisa el progreso, califica tareas y proporciona retroalimentación.',
              action: 'Ver estudiantes'
            },
            {
              icon: '📈',
              title: 'Analiza el rendimiento',
              description: 'Accede a reportes detallados sobre el progreso y participación.',
              action: 'Ver reportes'
            }
          ],
          primaryAction: 'Crear mi primer curso',
          secondaryActions: ['Gestionar clases', 'Ver estadísticas']
        };

      case 'admin':
        return {
          features: [
            {
              icon: '⚙️',
              title: 'Administra usuarios',
              description: 'Gestiona cuentas de estudiantes, profesores y permisos del sistema.',
              action: 'Gestionar usuarios'
            },
            {
              icon: '🏫',
              title: 'Configura la institución',
              description: 'Personaliza ajustes, políticas y configuraciones institucionales.',
              action: 'Configurar escuela'
            },
            {
              icon: '📊',
              title: 'Monitorea actividad',
              description: 'Supervisa el uso del sistema, rendimiento y métricas clave.',
              action: 'Ver dashboard'
            },
            {
              icon: '📋',
              title: 'Genera reportes',
              description: 'Crea informes institucionales, estadísticas y análisis detallados.',
              action: 'Generar reporte'
            }
          ],
          primaryAction: 'Ir al panel de administración',
          secondaryActions: ['Gestionar usuarios', 'Ver estadísticas']
        };

      case 'school_owner':
        return {
          features: [
            {
              icon: '🏫',
              title: 'Gestiona tu escuela',
              description: 'Administra completamente tu institución, desde configuración hasta personal.',
              action: 'Configurar escuela'
            },
            {
              icon: '👨‍🏫',
              title: 'Administra personal',
              description: 'Invita profesores, asigna roles y gestiona el equipo educativo.',
              action: 'Invitar profesores'
            },
            {
              icon: '💰',
              title: 'Control financiero',
              description: 'Supervisa subscripciones, pagos y recursos financieros.',
              action: 'Ver facturación'
            },
            {
              icon: '📈',
              title: 'Reportes institucionales',
              description: 'Accede a métricas completas sobre el rendimiento de tu institución.',
              action: 'Ver analíticas'
            }
          ],
          primaryAction: 'Gestionar mi escuela',
          secondaryActions: ['Invitar personal', 'Ver reportes']
        };

      default:
        return {
          features: [
            {
              icon: '🎯',
              title: 'Explora la plataforma',
              description: 'Descubre todas las funcionalidades disponibles para tu rol.',
              action: 'Explorar'
            }
          ],
          primaryAction: 'Comenzar',
          secondaryActions: []
        };
    }
  };

  const { features, primaryAction, secondaryActions } = getRoleFeaturesAndActions();

  const handleNext = () => {
    if (currentFeatureIndex < features.length - 1) {
      setCurrentFeatureIndex(currentFeatureIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentFeatureIndex > 0) {
      setCurrentFeatureIndex(currentFeatureIndex - 1);
    }
  };

  const handleComplete = () => {
    onNext('quick_tour', { 
      tourCompleted: true,
      featuresViewed: features.length,
      completionTime: new Date().toISOString(),
      userRole: user.role
    });
  };

  const handleSkipTour = () => {
    onSkip('User chose to skip the quick tour');
  };

  const currentFeature = features[currentFeatureIndex];

  return (
    <div className={styles.stepContainer}>
      <div className={styles.content}>
        <h2 className={styles.title}>¡Ya casi terminamos!</h2>
        
        <p className={styles.subtitle}>
          Aquí tienes un vistazo rápido a las principales funcionalidades que puedes usar como {' '}
          <strong>{user.role === 'student' ? 'estudiante' : 
                   user.role === 'teacher' ? 'profesor' : 
                   user.role === 'admin' ? 'administrador' : 'propietario de escuela'}</strong>.
        </p>

        <div className={styles.tourContainer}>
          <div className={styles.featureShowcase}>
            <div className={styles.featureIcon}>{currentFeature.icon}</div>
            <h3 className={styles.featureTitle}>{currentFeature.title}</h3>
            <p className={styles.featureDescription}>{currentFeature.description}</p>
            
            <button className={styles.featureActionButton}>
              {currentFeature.action}
            </button>
          </div>

          <div className={styles.tourNavigation}>
            <div className={styles.tourProgress}>
              <span>{currentFeatureIndex + 1} de {features.length}</span>
              <div className={styles.progressDots}>
                {features.map((_, index) => (
                  <button
                    key={index}
                    className={`${styles.progressDot} ${
                      index === currentFeatureIndex ? styles.active : ''
                    } ${index < currentFeatureIndex ? styles.completed : ''}`}
                    onClick={() => setCurrentFeatureIndex(index)}
                  />
                ))}
              </div>
            </div>

            <div className={styles.tourControls}>
              <button 
                className={styles.secondaryButton}
                onClick={handlePrevious}
                disabled={currentFeatureIndex === 0}
              >
                Anterior
              </button>
              
              {currentFeatureIndex < features.length - 1 ? (
                <button 
                  className={styles.primaryButton}
                  onClick={handleNext}
                >
                  Siguiente
                </button>
              ) : (
                <button 
                  className={styles.primaryButton}
                  onClick={handleComplete}
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Finalizando...' : 'Finalizar'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.quickActions}>
          <h4>Acciones rápidas para comenzar:</h4>
          <div className={styles.actionButtons}>
            <button className={styles.primaryActionButton}>
              {primaryAction}
            </button>
            {secondaryActions.map((action, index) => (
              <button key={index} className={styles.secondaryActionButton}>
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button 
            className={styles.skipButton}
            onClick={handleSkipTour}
            disabled={isUpdating}
          >
            Saltar tour
          </button>
        </div>
        
        <div className={styles.stepInfo}>
          <p>
            🎉 ¡Perfecto! Tu cuenta está lista. Puedes acceder a un tour más detallado 
            desde el menú de ayuda en cualquier momento.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuickTourStep; 