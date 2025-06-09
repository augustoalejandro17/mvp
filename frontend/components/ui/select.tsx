import React, { useState, useRef, useEffect } from 'react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectContentProps {
  children: React.ReactNode;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
}

interface SelectValueProps {
  placeholder?: string;
}

const SelectContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
}>({});

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <SelectContext.Provider value={{ value, onValueChange, isOpen, setIsOpen }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children, className = '' }) => {
  const { isOpen, setIsOpen } = React.useContext(SelectContext);
  
  return (
    <button
      type="button"
      className={`flex items-center justify-between w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
      onClick={() => setIsOpen?.(!isOpen)}
    >
      {children}
      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
};

export const SelectContent: React.FC<SelectContentProps> = ({ children }) => {
  const { isOpen, setIsOpen } = React.useContext(SelectContext);
  
  if (!isOpen) return null;
  
  return (
    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
      <div className="py-1">
        {children}
      </div>
    </div>
  );
};

export const SelectItem: React.FC<SelectItemProps> = ({ value, children }) => {
  const { onValueChange, setIsOpen } = React.useContext(SelectContext);
  
  return (
    <button
      type="button"
      className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
      onClick={() => {
        onValueChange?.(value);
        setIsOpen?.(false);
      }}
    >
      {children}
    </button>
  );
};

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => {
  const { value } = React.useContext(SelectContext);
  
  return (
    <span className="text-gray-900">
      {value || placeholder}
    </span>
  );
}; 