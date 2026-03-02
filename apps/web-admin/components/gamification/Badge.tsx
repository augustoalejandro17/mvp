import React from 'react';
import Image from 'next/image';

export interface BadgeData {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  type: 'attendance' | 'video_watching' | 'engagement' | 'completion' | 'streak' | 'special' | 'milestone';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  pointsReward: number;
  isEarned: boolean;
  earnedAt?: Date;
  progress?: {
    current: number;
    required: number;
    percentage: number;
  };
  color?: string;
}

interface BadgeProps {
  badge: BadgeData;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  showTooltip?: boolean;
  onClick?: () => void;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  badge,
  size = 'medium',
  showProgress = true,
  showTooltip = true,
  onClick,
  className = '',
}) => {
  const sizeClasses = {
    small: 'w-12 h-12 sm:w-14 sm:h-14',
    medium: 'w-16 h-16 sm:w-20 sm:h-20',
    large: 'w-24 h-24 sm:w-28 sm:h-28',
  };

  const rarityClasses = {
    common: 'border-gray-300 bg-gray-50',
    rare: 'border-blue-400 bg-blue-50 shadow-md shadow-blue-100',
    epic: 'border-purple-400 bg-purple-50 shadow-lg shadow-purple-100',
    legendary: 'border-yellow-400 bg-yellow-50 shadow-xl shadow-yellow-100',
  };

  const typeEmojis = {
    attendance: '📅',
    video_watching: '📹',
    engagement: '💬',
    completion: '✅',
    streak: '🔥',
    special: '⭐',
    milestone: '🏆',
  };

  const isClickable = onClick !== undefined;

  return (
    <div 
      className={`
        relative inline-block group
        ${className}
      `}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${badge.name} badge${badge.isEarned ? ' (earned)' : ' (in progress)'}`}
      aria-describedby={showTooltip ? `badge-tooltip-${badge.id}` : undefined}
    >
      {/* Badge Container */}
      <div
        className={`
          ${sizeClasses[size]}
          ${rarityClasses[badge.rarity]}
          ${badge.isEarned ? 'opacity-100' : 'opacity-50 grayscale'}
          ${isClickable ? 'cursor-pointer hover:scale-105 focus:scale-105' : ''}
          border-2 rounded-full
          flex items-center justify-center
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
        style={{
          backgroundColor: badge.color && badge.isEarned ? `${badge.color}20` : undefined,
          borderColor: badge.color && badge.isEarned ? badge.color : undefined,
        }}
      >
        {/* Badge Icon */}
        <div className="relative w-full h-full flex items-center justify-center">
          {badge.iconUrl ? (
            <Image
              src={badge.iconUrl}
              alt={badge.name}
              width={size === 'small' ? 32 : size === 'medium' ? 48 : 64}
              height={size === 'small' ? 32 : size === 'medium' ? 48 : 64}
              className="rounded-full object-cover"
              onError={(e) => {
                // Fallback to emoji if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                if (target.nextSibling) {
                  (target.nextSibling as HTMLElement).style.display = 'block';
                }
              }}
            />
          ) : null}
          
          {/* Fallback Emoji */}
          <div 
            className={`
              ${badge.iconUrl ? 'hidden' : 'block'}
              text-${size === 'small' ? 'lg' : size === 'medium' ? '2xl' : '4xl'}
            `}
            style={{ display: badge.iconUrl ? 'none' : 'block' }}
          >
            {typeEmojis[badge.type]}
          </div>
        </div>

        {/* Earned Indicator */}
        {badge.isEarned && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white">
            <span className="sr-only">Earned</span>
          </div>
        )}

        {/* Rarity Indicator */}
        {badge.rarity !== 'common' && (
          <div className="absolute -bottom-1 -right-1">
            <div
              className={`
                w-3 h-3 rounded-full border border-white
                ${badge.rarity === 'rare' ? 'bg-blue-500' : ''}
                ${badge.rarity === 'epic' ? 'bg-purple-500' : ''}
                ${badge.rarity === 'legendary' ? 'bg-yellow-500' : ''}
              `}
            >
              <span className="sr-only">{badge.rarity} rarity</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && badge.progress && !badge.isEarned && (
        <div className="mt-2 w-full">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${badge.progress.percentage}%` }}
              role="progressbar"
              aria-valuenow={badge.progress.current}
              aria-valuemin={0}
              aria-valuemax={badge.progress.required}
              aria-label={`Progress: ${badge.progress.current} of ${badge.progress.required}`}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-center">
            {badge.progress.current}/{badge.progress.required}
          </div>
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div
          id={`badge-tooltip-${badge.id}`}
          className="
            absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
            opacity-0 group-hover:opacity-100 group-focus:opacity-100
            transition-opacity duration-200
            pointer-events-none
            z-50
          "
          role="tooltip"
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap max-w-xs">
            <div className="font-semibold">{badge.name}</div>
            <div className="text-gray-300 mt-1">{badge.description}</div>
            {badge.pointsReward > 0 && (
              <div className="text-yellow-300 mt-1">
                +{badge.pointsReward} points
              </div>
            )}
            {badge.isEarned && badge.earnedAt && (
              <div className="text-green-300 mt-1">
                Earned {new Date(badge.earnedAt).toLocaleDateString()}
              </div>
            )}
            
            {/* Tooltip Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Badge; 