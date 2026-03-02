import React, { useState } from 'react';
import FilterGroup from './common/FilterGroup';
import { FilterConfig, FilterValue } from '../types/filters';
import styles from '../styles/CourseFilters.module.css';

interface CourseFiltersProps {
  onFiltersChange: (filters: FilterValue) => void;
  teachers?: { id: string; name: string }[];
}

const CourseFilters: React.FC<CourseFiltersProps> = ({ onFiltersChange, teachers = [] }) => {
  const [filterValues, setFilterValues] = useState<FilterValue>({
    search: '',
    teacherId: ''
  });

  const filterConfigs: FilterConfig[] = [
    {
      id: 'search',
      label: '',
      type: 'search',
      placeholder: 'Buscar cursos...'
    },
    {
      id: 'teacherId',
      label: '',
      type: 'select',
      options: [
        { id: 'all', label: 'Todos los Profesores', value: '' },
        ...teachers.map(teacher => ({
          id: teacher.id,
          label: teacher.name,
          value: teacher.id
        }))
      ]
    }
  ];

  const handleFiltersChange = (newValues: FilterValue) => {
    setFilterValues(newValues);
    onFiltersChange(newValues);
  };

  return (
    <div className={styles.courseFilters}>
      <FilterGroup
        filters={filterConfigs}
        values={filterValues}
        onChange={handleFiltersChange}
      />
    </div>
  );
};

export default CourseFilters; 