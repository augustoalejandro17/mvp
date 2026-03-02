import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import styles from '../../../styles/OnboardingSteps.module.css';

interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  profileImageUrl?: string;
  phone?: string;
  dateOfBirth?: string;
  bio?: string;
}

interface OnboardingData {
  hasOnboarded: boolean;
  onboardingProgress: any;
  profileCompletion: number;
  userRole: string;
  needsOnboarding: boolean;
}

interface ProfileCompletionStepProps {
  user: User;
  onNext: (step: string, stepData?: Record<string, any>) => void;
  onSkip: (reason?: string) => void;
  isUpdating: boolean;
  onboardingData: OnboardingData;
}

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  bio: string;
}

const ProfileCompletionStep: React.FC<ProfileCompletionStepProps> = ({ 
  user, 
  onNext, 
  onSkip, 
  isUpdating,
  onboardingData
}) => {
  // Auto-populate firstName/lastName from existing name if not already set
  const getInitialNameFields = () => {
    if (user.firstName && user.lastName) {
      return { firstName: user.firstName, lastName: user.lastName };
    } else if (user.name) {
      // Split full name into first and last name
      const nameParts = user.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      return { firstName, lastName };
    }
    return { firstName: '', lastName: '' };
  };

  const [formData, setFormData] = useState<FormData>({
    ...getInitialNameFields(),
    phone: user.phone || '',
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
    bio: user.bio || ''
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [completionPercentage, setCompletionPercentage] = useState(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    calculateCompletion();
  }, [formData, user.role]);

  const calculateCompletion = () => {
    const fields = [
      { key: 'firstName', required: false }, // Optional since we have user.name
      { key: 'lastName', required: false },  // Optional since we have user.name
      { key: 'phone', required: false },
      { key: 'dateOfBirth', required: false },
      { key: 'bio', required: false }
    ];

    let totalFields = 0;
    let completedFields = 0;

    fields.forEach(({ key, required }) => {
      if (required || formData[key as keyof FormData]) {
        totalFields++;
        if (formData[key as keyof FormData]?.trim()) {
          completedFields++;
        }
      }
    });

    const percentage = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
    setCompletionPercentage(percentage);
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const validateForm = (): string | null => {
    // Name fields are optional since we already have user.name from registration
    if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      return 'El formato del teléfono no es válido';
    }
    return null;
  };

  const handleContinue = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSaving(true);
      const token = Cookies.get('token');

      // Update profile
      await axios.put(`${apiUrl}/api/auth/onboarding/profile`, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim() || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        bio: formData.bio.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Complete the step
      onNext('profile_completion', { 
        completionPercentage,
        fieldsCompleted: Object.keys(formData).filter(key => 
          formData[key as keyof FormData]?.trim()
        ),
        completionTime: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Error al actualizar el perfil. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onSkip('User chose to skip profile completion');
  };



  return (
    <div className={styles.stepContainer}>
      <div className={styles.content}>
        <h2 className={styles.title}>Completa tu perfil</h2>
        
        <p className={styles.subtitle}>
          Verifica y completa tu información de perfil. Puedes ajustar los datos 
          que ya proporcionaste o agregar información adicional.
        </p>

        <div className={styles.completionIndicator}>
          <div className={styles.completionText}>
            Perfil completado: {completionPercentage}%
          </div>
          <div className={styles.completionBar}>
            <div 
              className={styles.completionFill}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        <form className={styles.profileForm} onSubmit={(e) => e.preventDefault()}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="firstName">
                Nombre
              </label>
              <input
                type="text"
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={styles.formInput}
                placeholder="Tu nombre"
              />
              <div className={styles.fieldHint}>
                Pre-llenado desde tu registro
              </div>
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="lastName">
                Apellido
              </label>
              <input
                type="text"
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={styles.formInput}
                placeholder="Tu apellido"
              />
              <div className={styles.fieldHint}>
                Pre-llenado desde tu registro
              </div>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="phone">
                Teléfono
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={styles.formInput}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="dateOfBirth">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                id="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                className={styles.formInput}
              />
              <div className={styles.fieldHint}>
                Opcional: Ayuda a personalizar tu experiencia
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="bio">
              Biografía
            </label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              className={styles.formTextarea}
              placeholder="Cuéntanos un poco sobre ti..."
              rows={3}
            />
            <div className={styles.fieldHint}>
              Opcional: Agrega una breve descripción sobre ti
            </div>
          </div>
        </form>


        
        <div className={styles.actions}>
          <button 
            className={styles.primaryButton}
            onClick={handleContinue}
            disabled={isUpdating || isSaving}
          >
            {isSaving ? 'Guardando...' : 'Continuar'}
          </button>
          
          <button 
            className={styles.secondaryButton}
            onClick={handleSkip}
            disabled={isUpdating || isSaving}
          >
            Completar más tarde
          </button>
        </div>
        
        <div className={styles.stepInfo}>
          <p>Puedes actualizar esta información en cualquier momento desde tu perfil</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionStep; 