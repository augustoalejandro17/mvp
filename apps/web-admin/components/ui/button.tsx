import React from 'react';
import styles from './ui-primitives.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'default', 
  size = 'default', 
  className = '', 
  children, 
  disabled,
  ...props 
}) => {
  const variants = {
    default: styles.buttonDefault,
    outline: styles.buttonOutline,
    ghost: styles.buttonGhost,
    destructive: styles.buttonDestructive,
  };
  
  const sizes = {
    default: styles.sizeDefault,
    sm: styles.sizeSm,
    lg: styles.sizeLg,
  };
  
  return (
    <button
      className={`${styles.buttonBase} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}; 
