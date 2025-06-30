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

interface SchoolSetupStepProps {
  user: User;
  onNext: (step: string, stepData?: Record<string, any>) => void;
  onSkip: (reason?: string) => void;
  isUpdating: boolean;
  onboardingData: OnboardingData;
}

interface SchoolFormData {
  name: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  isPublic: boolean;
}

const SchoolSetupStep: React.FC<SchoolSetupStepProps> = ({ 
  user, 
  onNext, 
  onSkip, 
  isUpdating 
}) => {
  const [formData, setFormData] = useState<SchoolFormData>({
    name: '',
    description: '',
    address: '',
    phone: '',
    website: '',
    isPublic: false
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const handleInputChange = (field: keyof SchoolFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'El nombre de la escuela es requerido';
    }
    if (formData.name.length < 3) {
      return 'El nombre debe tener al menos 3 caracteres';
    }
    if (formData.website && !isValidUrl(formData.website)) {
      return 'La URL del sitio web no es válida';
    }
    if (formData.phone && !/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      return 'El formato del teléfono no es válido';
    }
    return null;
  };

  const isValidUrl = (string: string): boolean => {
    try {
      const url = new URL(string.startsWith('http') ? string : `https://${string}`);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
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

      const schoolData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        address: formData.address.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        website: formData.website.trim() || undefined,
        isPublic: formData.isPublic
      };

      // Create school
      const response = await axios.post(`${apiUrl}/api/auth/onboarding/school/setup`, schoolData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Complete the step
      onNext('school_setup', { 
        schoolId: response.data.data.id,
        schoolName: response.data.data.name,
        isPublic: response.data.data.isPublic,
        setupTime: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error setting up school:', error);
      const errorMessage = error.response?.data?.message || 'Error al configurar la escuela. Intenta de nuevo.';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onSkip('School owner chose to skip school setup');
  };

  return (
    <div className={styles.stepContainer}>
      <div className={styles.content}>
        <h2 className={styles.title}>Configura tu escuela</h2>
        
        <p className={styles.subtitle}>
          Como propietario de escuela, vamos a configurar la información básica de tu institución.
          Esto ayudará a estudiantes y profesores a encontrarla y conectarse.
        </p>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        <form className={styles.profileForm} onSubmit={(e) => e.preventDefault()}>
          <div className={styles.formGroup}>
            <label htmlFor="schoolName" className={styles.required}>
              Nombre de la escuela
            </label>
            <input
              type="text"
              id="schoolName"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={styles.formInput}
              placeholder="Ej: Instituto Tecnológico Nacional"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">
              Descripción
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={styles.formTextarea}
              placeholder="Describe tu institución educativa..."
              rows={3}
            />
            <div className={styles.fieldHint}>
              Una breve descripción que aparecerá en el directorio de escuelas
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="phone">
                Teléfono principal
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
              <label htmlFor="website">
                Sitio web
              </label>
              <input
                type="url"
                id="website"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                className={styles.formInput}
                placeholder="www.tuescuela.com"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="address">
              Dirección
            </label>
            <input
              type="text"
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              className={styles.formInput}
              placeholder="Calle Principal 123, Ciudad, País"
            />
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>
                Hacer mi escuela pública
              </span>
            </label>
            <div className={styles.fieldHint}>
              Las escuelas públicas aparecen en el directorio y permiten que estudiantes se registren libremente.
              Las escuelas privadas solo son accesibles por invitación.
            </div>
          </div>
        </form>

        <div className={styles.schoolPreview}>
          <h4>Vista previa:</h4>
          <div className={styles.schoolCard}>
            <div className={styles.schoolHeader}>
              <div className={styles.schoolIcon}>🏫</div>
              <div className={styles.schoolInfo}>
                <h3>{formData.name || 'Nombre de la escuela'}</h3>
                <span className={formData.isPublic ? styles.publicBadge : styles.privateBadge}>
                  {formData.isPublic ? 'Pública' : 'Privada'}
                </span>
              </div>
            </div>
            {formData.description && (
              <p className={styles.schoolDescription}>{formData.description}</p>
            )}
            <div className={styles.schoolDetails}>
              {formData.address && <div>📍 {formData.address}</div>}
              {formData.phone && <div>📞 {formData.phone}</div>}
              {formData.website && <div>🌐 {formData.website}</div>}
            </div>
          </div>
        </div>
        
        <div className={styles.actions}>
          <button 
            className={styles.primaryButton}
            onClick={handleContinue}
            disabled={isUpdating || isSaving || !formData.name.trim()}
          >
            {isSaving ? 'Creando escuela...' : 'Crear escuela'}
          </button>
          
          <button 
            className={styles.secondaryButton}
            onClick={handleSkip}
            disabled={isUpdating || isSaving}
          >
            Configurar más tarde
          </button>
        </div>
        
        <div className={styles.stepInfo}>
          <p>Podrás agregar más detalles, logo y gestionar personal después</p>
        </div>
      </div>
    </div>
  );
};

export default SchoolSetupStep; 