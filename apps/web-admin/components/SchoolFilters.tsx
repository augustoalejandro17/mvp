import React, { useState } from 'react';
import FilterGroup from './common/FilterGroup';
import { FilterConfig, FilterValue } from '../types/filters';

interface SchoolFiltersProps {
  onFiltersChange: (filters: FilterValue) => void;
}

const SchoolFilters: React.FC<SchoolFiltersProps> = ({ onFiltersChange }) => {
  const [filterValues, setFilterValues] = useState<FilterValue>({
    search: '',
    type: '',
    status: 'active',
    hasPrograms: false
  });

  const filterConfigs: FilterConfig[] = [
    {
      id: 'search',
      label: 'Buscar escuela',
      type: 'search',
      placeholder: 'Nombre de la escuela...'
    },
    {
      id: 'type',
      label: 'Tipo',
      type: 'select',
      options: [
        { id: 'public', label: 'Pública', value: 'public' },
        { id: 'private', label: 'Privada', value: 'private' },
        { id: 'charter', label: 'Charter', value: 'charter' }
      ]
    },
    {
      id: 'status',
      label: 'Estado',
      type: 'radio',
      options: [
        { id: 'active', label: 'Activa', value: 'active' },
        { id: 'inactive', label: 'Inactiva', value: 'inactive' },
        { id: 'all', label: 'Todas', value: 'all' }
      ]
    },
    {
      id: 'hasPrograms',
      label: 'Con programas activos',
      type: 'checkbox'
    }
  ];

  const handleFiltersChange = (newValues: FilterValue) => {
    setFilterValues(newValues);
    onFiltersChange(newValues);
  };

  return (
    <FilterGroup
      filters={filterConfigs}
      values={filterValues}
      onChange={handleFiltersChange}
    />
  );
};

export default SchoolFilters; 