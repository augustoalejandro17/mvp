import React, { useState, useCallback } from 'react';
import styles from '../styles/MobileOptimizedButton.module.css';

interface MobileOptimizedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'small' | 'medium' | 'large' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  hapticFeedback?: boolean;
}

const MobileOptimizedButton: React.FC<MobileOptimizedButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  type = 'button',
  hapticFeedback = true
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = useCallback(() => {
    if (disabled || loading) return;

    // Haptic feedback for mobile devices
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10); // Short vibration
    }

    onClick?.();
  }, [disabled, loading, hapticFeedback, onClick]);

  const handleTouchStart = useCallback(() => {
    if (disabled || loading) return;
    setIsPressed(true);
  }, [disabled, loading]);

  const handleTouchEnd = useCallback(() => {
    setIsPressed(false);
  }, []);

  const buttonClasses = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    loading && styles.loading,
    isPressed && styles.pressed,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
    >
      <div className={styles.content}>
        {loading && (
          <div className={styles.loadingSpinner} />
        )}
        
        {!loading && icon && iconPosition === 'left' && (
          <span className={styles.iconLeft}>
            {icon}
          </span>
        )}
        
        <span className={styles.text}>
          {children}
        </span>
        
        {!loading && icon && iconPosition === 'right' && (
          <span className={styles.iconRight}>
            {icon}
          </span>
        )}
      </div>
    </button>
  );
};

export default MobileOptimizedButton; 