import React from 'react';
import Filter from './Filter';
import { FilterConfig, FilterValue } from '../../types/filters';
import styles from '../../styles/FilterGroup.module.css';

interface FilterGroupProps {
  filters: FilterConfig[];
  values: FilterValue;
  onChange: (values: FilterValue) => void;
  className?: string;
}

const FilterGroup: React.FC<FilterGroupProps> = ({
  filters,
  values,
  onChange,
  className = '',
}) => {
  const handleFilterChange = (filterId: string, value: any) => {
    onChange({
      ...values,
      [filterId]: value,
    });
  };

  return (
    <div className={`${styles.filterGroup} ${className}`}>
      {filters.map((filter) => (
        <Filter
          key={filter.id}
          config={filter}
          value={values}
          onChange={handleFilterChange}
        />
      ))}
    </div>
  );
};

export default FilterGroup; 