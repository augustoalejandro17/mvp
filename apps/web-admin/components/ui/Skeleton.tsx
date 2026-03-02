import React from 'react';
import styles from '../../styles/Skeleton.module.css';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'wave',
}) => {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`${styles.skeleton} ${styles[variant]} ${styles[animation]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

// Card Skeleton for course/school cards
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.cardSkeleton} ${className}`}>
      <Skeleton variant="rectangular" height={160} />
      <div className={styles.cardContent}>
        <Skeleton variant="text" width="70%" height={24} />
        <Skeleton variant="text" width="100%" height={16} />
        <Skeleton variant="text" width="60%" height={16} />
        <div className={styles.cardFooter}>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width="40%" height={14} />
        </div>
      </div>
    </div>
  );
};

// List Item Skeleton
export const ListItemSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.listItemSkeleton} ${className}`}>
      <Skeleton variant="circular" width={40} height={40} />
      <div className={styles.listItemContent}>
        <Skeleton variant="text" width="60%" height={18} />
        <Skeleton variant="text" width="40%" height={14} />
      </div>
      <Skeleton variant="rounded" width={80} height={32} />
    </div>
  );
};

// Table Row Skeleton
export const TableRowSkeleton: React.FC<{ columns?: number; className?: string }> = ({ 
  columns = 5, 
  className = '' 
}) => {
  return (
    <div className={`${styles.tableRowSkeleton} ${className}`}>
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} variant="text" width={`${100 / columns}%`} height={20} />
      ))}
    </div>
  );
};

// Stats Card Skeleton
export const StatsCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.statsCardSkeleton} ${className}`}>
      <div className={styles.statsHeader}>
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton variant="text" width="60%" height={16} />
      </div>
      <Skeleton variant="text" width="40%" height={36} />
      <Skeleton variant="text" width="80%" height={14} />
    </div>
  );
};

// Video Player Skeleton
export const VideoSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.videoSkeleton} ${className}`}>
      <Skeleton variant="rectangular" height="100%" />
      <div className={styles.playButtonSkeleton}>
        <Skeleton variant="circular" width={64} height={64} />
      </div>
    </div>
  );
};

// Profile Skeleton
export const ProfileSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.profileSkeleton} ${className}`}>
      <div className={styles.profileHeader}>
        <Skeleton variant="circular" width={80} height={80} />
        <div className={styles.profileInfo}>
          <Skeleton variant="text" width={200} height={24} />
          <Skeleton variant="text" width={150} height={16} />
        </div>
      </div>
      <div className={styles.profileBody}>
        <Skeleton variant="text" width="100%" height={16} />
        <Skeleton variant="text" width="100%" height={16} />
        <Skeleton variant="text" width="70%" height={16} />
      </div>
    </div>
  );
};

// Navigation Skeleton
export const NavigationSkeleton: React.FC = () => {
  return (
    <div className={styles.navigationSkeleton}>
      <Skeleton variant="rounded" width={100} height={32} />
      <div className={styles.navLinks}>
        <Skeleton variant="text" width={60} height={20} />
        <Skeleton variant="text" width={80} height={20} />
        <Skeleton variant="text" width={70} height={20} />
      </div>
      <Skeleton variant="circular" width={36} height={36} />
    </div>
  );
};

export default Skeleton;


