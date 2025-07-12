import React from 'react';

export interface ProgressData {
  current: number;
  target: number;
  label: string;
  color?: string;
  showPercentage?: boolean;
  showNumbers?: boolean;
  animated?: boolean;
}

interface ProgressBarProps {
  progress: ProgressData;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  onClick?: () => void;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = 'medium',
  className = '',
  onClick,
}) => {
  const percentage = Math.min((progress.current / progress.target) * 100, 100);
  const isClickable = onClick !== undefined;

  const sizeClasses = {
    small: 'h-2',
    medium: 'h-3',
    large: 'h-4',
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  const getProgressColor = () => {
    if (progress.color) return progress.color;
    
    if (percentage >= 100) return '#10B981'; // green-500
    if (percentage >= 75) return '#3B82F6';  // blue-500
    if (percentage >= 50) return '#F59E0B';  // amber-500
    return '#EF4444'; // red-500
  };

  const getBackgroundColor = () => {
    if (progress.color) {
      // Convert hex to rgba with low opacity
      const hex = progress.color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, 0.1)`;
    }
    return '#F3F4F6'; // gray-100
  };

  return (
    <div
      className={`w-full ${className}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${progress.label}: ${progress.current} of ${progress.target} (${Math.round(percentage)}%)`}
    >
      {/* Progress Label and Stats */}
      <div className="flex justify-between items-center mb-2">
        <span 
          className={`
            font-medium text-gray-700
            ${textSizeClasses[size]}
            ${isClickable ? 'cursor-pointer' : ''}
          `}
        >
          {progress.label}
        </span>
        
        <div className={`flex items-center space-x-2 ${textSizeClasses[size]}`}>
          {progress.showNumbers && (
            <span className="text-gray-500">
              {progress.current.toLocaleString()}/{progress.target.toLocaleString()}
            </span>
          )}
          
          {progress.showPercentage && (
            <span 
              className="font-semibold"
              style={{ color: getProgressColor() }}
            >
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar Container */}
      <div
        className={`
          ${sizeClasses[size]}
          w-full rounded-full overflow-hidden
          ${isClickable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' : ''}
          transition-all duration-200
        `}
        style={{ backgroundColor: getBackgroundColor() }}
        role="progressbar"
        aria-valuenow={progress.current}
        aria-valuemin={0}
        aria-valuemax={progress.target}
      >
        {/* Progress Fill */}
        <div
          className={`
            h-full rounded-full transition-all duration-500 ease-out
            ${progress.animated ? 'animate-pulse' : ''}
            relative overflow-hidden
          `}
          style={{ 
            width: `${percentage}%`,
            backgroundColor: getProgressColor(),
          }}
        >
          {/* Animated Shine Effect */}
          {progress.animated && percentage > 0 && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
          )}
        </div>
      </div>

      {/* Milestone Markers */}
      {progress.target > 100 && (
        <div className="relative mt-1">
          {[25, 50, 75].map((milestone) => {
            const milestoneValue = (milestone / 100) * progress.target;
            const milestonePosition = (milestoneValue / progress.target) * 100;
            const isPassed = progress.current >= milestoneValue;

            return (
              <div
                key={milestone}
                className="absolute top-0 transform -translate-x-1/2"
                style={{ left: `${milestonePosition}%` }}
              >
                <div
                  className={`
                    w-1 h-2 rounded-full
                    ${isPassed ? 'bg-green-500' : 'bg-gray-300'}
                    transition-colors duration-300
                  `}
                  title={`${milestone}% milestone (${milestoneValue.toLocaleString()})`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Completion Badge */}
      {percentage >= 100 && (
        <div className="flex items-center justify-center mt-2">
          <div className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold flex items-center">
            <span className="mr-1">🎉</span>
            Complete!
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressBar; 