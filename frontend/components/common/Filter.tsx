import React from 'react';
import { FilterProps } from '../../types/filters';
import styles from '../../styles/Filter.module.css';

const Filter: React.FC<FilterProps> = ({ config, value, onChange, className = '' }) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const newValue = event.target.type === 'checkbox' 
      ? (event.target as HTMLInputElement).checked
      : event.target.value;
    onChange(config.id, newValue);
  };

  const handleMultiSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
    onChange(config.id, selectedOptions);
  };

  switch (config.type) {
    case 'select':
      return (
        <div className={`${styles.filterContainer} ${className}`}>
          <label htmlFor={config.id} className={styles.filterLabel}>{config.label}</label>
          <select
            id={config.id}
            value={value[config.id] as string}
            onChange={handleChange}
            className={styles.filterSelect}
          >
            <option value="">{config.placeholder || 'Seleccionar...'}</option>
            {config.options?.map(option => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'multiselect':
      return (
        <div className={`${styles.filterContainer} ${className}`}>
          <label htmlFor={config.id} className={styles.filterLabel}>{config.label}</label>
          <select
            id={config.id}
            multiple
            value={value[config.id] as string[]}
            onChange={handleMultiSelect}
            className={styles.filterMultiSelect}
          >
            {config.options?.map(option => (
              <option key={option.id} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'search':
      return (
        <div className={`${styles.filterContainer} ${className}`}>
          <label htmlFor={config.id} className={styles.filterLabel}>{config.label}</label>
          <input
            type="text"
            id={config.id}
            value={value[config.id] as string}
            onChange={handleChange}
            placeholder={config.placeholder}
            className={styles.filterSearch}
          />
        </div>
      );

    case 'checkbox':
      return (
        <div className={`${styles.filterContainer} ${className}`}>
          <label className={styles.filterCheckboxLabel}>
            <input
              type="checkbox"
              id={config.id}
              checked={value[config.id] as boolean}
              onChange={handleChange}
              className={styles.filterCheckbox}
            />
            {config.label}
          </label>
        </div>
      );

    case 'radio':
      return (
        <div className={`${styles.filterContainer} ${className}`}>
          <fieldset className={styles.filterRadioGroup}>
            <legend className={styles.filterLabel}>{config.label}</legend>
            {config.options?.map(option => (
              <label key={option.id} className={styles.filterRadioLabel}>
                <input
                  type="radio"
                  name={config.id}
                  value={option.value}
                  checked={value[config.id] === option.value}
                  onChange={handleChange}
                  className={styles.filterRadio}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        </div>
      );

    default:
      return null;
  }
};

export default Filter; 