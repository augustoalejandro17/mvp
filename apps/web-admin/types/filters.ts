export type FilterOption = {
  id: string;
  label: string;
  value: string | number;
};

export type FilterConfig = {
  id: string;
  label: string;
  type: 'select' | 'search' | 'multiselect' | 'checkbox' | 'radio';
  options?: FilterOption[];
  placeholder?: string;
};

export type FilterValue = {
  [key: string]: string | string[] | number | boolean;
};

export type FilterChangeHandler = (filterId: string, value: any) => void;

export interface FilterProps {
  config: FilterConfig;
  value: FilterValue;
  onChange: FilterChangeHandler;
  className?: string;
} 