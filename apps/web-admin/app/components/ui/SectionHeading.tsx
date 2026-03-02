import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  description?: string;
  centered?: boolean;
  className?: string;
  children?: ReactNode;
}

export const SectionHeading = ({
  title,
  subtitle,
  description,
  centered = true,
  className = '',
  children,
}: SectionHeadingProps) => {
  return (
    <div className={cn(
      'space-y-4',
      centered && 'text-center',
      className
    )}>
      {subtitle && (
        <p className="text-sm font-semibold text-amber-600 uppercase tracking-wide">
          {subtitle}
        </p>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          {description}
        </p>
      )}
      {children}
    </div>
  );
};



