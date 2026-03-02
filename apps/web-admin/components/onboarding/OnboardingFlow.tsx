import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import styles from '../../styles/Onboarding.module.css';

// Import step components
import WelcomeStep from './steps/WelcomeStep';
import UserTypeSelectionStep from './steps/UserTypeSelectionStep';
import ProfileCompletionStep from './steps/ProfileCompletionStep';
import LoadingSpinner from '../ui/LoadingSpinner';

interface OnboardingProgress {
  currentStep: string;
  completedSteps: string[];
  startedAt: string;
  completedAt?: string;
  isCompleted: boolean;
  stepData: Record<string, any>;
}

interface OnboardingData {
  hasOnboarded: boolean;
  onboardingProgress: OnboardingProgress;
  profileCompletion: number;
  userRole: string;
  needsOnboarding: boolean;
}

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

interface DecodedToken {
  sub: string;
  email: string;
  name: string;
  role: string;
}

const OnboardingFlow: React.FC = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<string>('welcome');
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    initializeOnboarding();
  }, []);

  const initializeOnboarding = async () => {
    try {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login');
        return;
      }

      // Decode token to get user info
      const decoded = jwtDecode<DecodedToken>(token);
      setUser({
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role
      });

      // Get onboarding status
      const response = await axios.get(`${apiUrl}/api/auth/onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data.data;
      setOnboardingData(data);

      // If already onboarded, redirect to dashboard
      if (data.hasOnboarded) {
        router.push('/');
        return;
      }

      // Set current step or initialize onboarding
      if (data.onboardingProgress && data.onboardingProgress.currentStep) {
        setCurrentStep(data.onboardingProgress.currentStep);
      } else {
        // Initialize onboarding
        await axios.post(`${apiUrl}/api/auth/onboarding/initialize`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentStep('welcome');
      }

      // Log analytics event
      await logAnalyticsEvent('onboarding_started', currentStep);

    } catch (error) {
      console.error('Error initializing onboarding:', error);
      setError('Error al inicializar el proceso de bienvenida. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const logAnalyticsEvent = async (event: string, step: string, metadata?: Record<string, any>) => {
    try {
      const token = Cookies.get('token');
      if (!token) return;

      await axios.post(`${apiUrl}/api/auth/onboarding/analytics`, {
        event,
        step,
        metadata
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.log('Analytics logging failed:', error);
      // Don't throw error for analytics failures
    }
  };

  const completeStep = async (step: string, stepData?: Record<string, any>) => {
    try {
      setIsUpdating(true);
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await axios.post(`${apiUrl}/api/auth/onboarding/step/complete`, {
        step,
        stepData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const updatedProgress = response.data.data;
      
      // Update local state
      if (onboardingData) {
        setOnboardingData({
          ...onboardingData,
          onboardingProgress: updatedProgress
        });
      }

      // Log analytics
      await logAnalyticsEvent('step_completed', step, stepData);

      // Check if onboarding is completed
      if (updatedProgress.isCompleted) {
        await logAnalyticsEvent('onboarding_completed', 'completed');
        // Redirect to dashboard with success message
        router.push('/?onboarded=true');
        return;
      }

      // Move to next step
      setCurrentStep(updatedProgress.currentStep);

    } catch (error) {
      console.error('Error completing step:', error);
      setError('Error al completar el paso. Por favor, intenta de nuevo.');
    } finally {
      setIsUpdating(false);
    }
  };

  const skipOnboarding = async (reason?: string) => {
    try {
      const token = Cookies.get('token');
      if (!token) {
        router.push('/login');
        return;
      }

      await axios.post(`${apiUrl}/api/auth/onboarding/skip`, {
        reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await logAnalyticsEvent('onboarding_skipped', currentStep, { reason });
      router.push('/');

    } catch (error) {
      console.error('Error skipping onboarding:', error);
      setError('Error al saltar la introducción.');
    }
  };

  const renderStep = () => {
    if (!user || !onboardingData) return null;

    const commonProps = {
      user,
      onNext: completeStep,
      onSkip: skipOnboarding,
      isUpdating,
      onboardingData
    };

    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep {...commonProps} />;
      case 'user_type_selection':
        return <UserTypeSelectionStep {...commonProps} />;
      case 'profile_completion':
        return <ProfileCompletionStep {...commonProps} />;
      default:
        return <WelcomeStep {...commonProps} />;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <LoadingSpinner />
        <p>Preparando tu experiencia de bienvenida...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryButton}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ 
            width: `${getProgressPercentage()}%` 
          }}
        />
      </div>
      <div className={styles.stepContainer}>
        {renderStep()}
      </div>
    </div>
  );

  function getProgressPercentage(): number {
    const steps = ['welcome', 'user_type_selection', 'profile_completion'];
    const currentIndex = steps.indexOf(currentStep);
    const totalSteps = 3; // Simplified to 3 steps for now
    return Math.round(((currentIndex + 1) / totalSteps) * 100);
  }
};

export default OnboardingFlow; 