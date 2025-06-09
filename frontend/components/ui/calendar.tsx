import React from 'react';

interface CalendarProps {
  mode?: 'single' | 'multiple' | 'range';
  selected?: Date | Date[] | { from: Date; to: Date };
  onSelect?: (date: Date | Date[] | { from: Date; to: Date } | undefined) => void;
  className?: string;
}

export const Calendar: React.FC<CalendarProps> = ({ 
  mode = 'single', 
  selected, 
  onSelect, 
  className = '' 
}) => {
  return (
    <div className={`p-4 bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="text-center text-gray-500">
        Calendar component placeholder
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Use date inputs for now
      </p>
    </div>
  );
}; 