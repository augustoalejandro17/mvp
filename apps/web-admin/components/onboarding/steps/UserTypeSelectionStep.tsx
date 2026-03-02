import React, { useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
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

interface UserTypeSelectionStepProps {
  user: User;
  onNext: (step: string, stepData?: Record<string, any>) => void;
  onSkip: (reason?: string) => void;
  isUpdating: boolean;
  onboardingData: OnboardingData;
}

interface UserType {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
}

const userTypes: UserType[] = [
  {
    id: 'student',
    title: 'Estudiante',
    description: 'Accede a cursos, completa tareas y monitorea tu progreso',
    icon: '🎓',
    features: [
      'Acceso a cursos y materiales',
      'Seguimiento de progreso',
      'Comunicación con profesores',
      'Tareas y evaluaciones'
    ]
  },
  {
    id: 'teacher',
    title: 'Profesor',
    description: 'Crea contenido, gestiona estudiantes y evalúa el progreso',
    icon: '👩‍🏫',
    features: [
      'Crear y gestionar cursos',
      'Subir contenido educativo',
      'Gestionar estudiantes',
      'Reportes de progreso'
    ]
  }
];

const UserTypeSelectionStep: React.FC<UserTypeSelectionStepProps> = ({ 
  user, 
  onNext, 
  onSkip, 
  isUpdating 
}) => {
  const [selectedType, setSelectedType] = useState<string>(user.role || '');
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const handleTypeSelect = (typeId: string) => {
    setSelectedType(typeId);
    setError('');
  };

  const handleContinue = async () => {
    if (!selectedType) {
      setError('Por favor selecciona tu tipo de usuario');
      return;
    }

    try {
      setIsSelecting(true);
      const token = Cookies.get('token');

      // Update user role if it's different from current
      if (selectedType !== user.role) {
        await axios.post(`${apiUrl}/api/auth/onboarding/role/select`, {
          role: selectedType
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // Complete the step
      onNext('user_type_selection', { 
        selectedRole: selectedType,
        previousRole: user.role,
        selectionTime: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error selecting user type:', error);
      setError('Error al seleccionar el tipo de usuario. Intenta de nuevo.');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleSkip = () => {
    onSkip('User chose to skip user type selection');
  };

  return (
    <div className={styles.stepContainer}>
      <div className={styles.content}>
        <h2 className={styles.title}>¿Cuál describe mejor tu rol?</h2>
        
        <p className={styles.subtitle}>
          Esto nos ayudará a personalizar tu experiencia y mostrarte las características más relevantes.
        </p>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
        
        <div className={styles.userTypeGrid}>
          {userTypes.map((type) => (
            <div
              key={type.id}
              className={`${styles.userTypeCard} ${
                selectedType === type.id ? styles.selected : ''
              }`}
              onClick={() => handleTypeSelect(type.id)}
            >
              <div className={styles.userTypeIcon}>{type.icon}</div>
              <h3 className={styles.userTypeTitle}>{type.title}</h3>
              <p className={styles.userTypeDescription}>{type.description}</p>
              
              <ul className={styles.userTypeFeatures}>
                {type.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              
              <div className={styles.radioButton}>
                <span className={styles.radioMark}></span>
              </div>
            </div>
          ))}
        </div>
        
        <div className={styles.actions}>
          <button 
            className={styles.primaryButton}
            onClick={handleContinue}
            disabled={isUpdating || isSelecting || !selectedType}
          >
            {isSelecting ? 'Configurando...' : 'Continuar'}
          </button>
          
          <button 
            className={styles.secondaryButton}
            onClick={handleSkip}
            disabled={isUpdating || isSelecting}
          >
            Mantener rol actual
          </button>
        </div>
        
        <div className={styles.stepInfo}>
          <p>Puedes cambiar tu rol más tarde en la configuración de tu perfil</p>
        </div>
      </div>
    </div>
  );
};

export default UserTypeSelectionStep; 