import React from 'react';
import styles from '../../styles/Stats.module.css';
import { RateIndicator } from './StatCards';

// Tipo para la configuraciu00f3n de columnas
interface Column {
  header: string;
  accessor: string;
  render?: (value: any, row: any) => React.ReactNode;
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  emptyMessage?: string;
}

const DataTable: React.FC<DataTableProps> = ({ 
  columns, 
  data, 
  emptyMessage = 'No hay datos disponibles' 
}) => {
  // Si no hay datos muestra mensaje
  if (!data || data.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index} style={column.width ? { width: column.width } : undefined}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, colIndex) => (
                <td key={`${rowIndex}-${colIndex}`}>
                  {column.render 
                    ? column.render(row[column.accessor], row)
                    : row[column.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Renderizadores comunes para columnas
export const ColumnRenderers = {
  // Renderiza una tasa con indicador de color
  rate: (value: number, type: 'retention' | 'attendance' | 'dropout') => {
    return <RateIndicator value={value} type={type} />;
  },
  
  // Renderiza un valor monetario
  currency: (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  },
  
  // Renderiza una fecha formateada
  date: (value: string) => {
    if (!value) return '-';
    const date = new Date(value);
    return new Intl.DateTimeFormat('es-AR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    }).format(date);
  },
  
  // Renderiza un enlace
  link: (value: string, text: string, href: string) => {
    return <a href={href} className="text-blue-500 hover:underline">{text || value}</a>;
  }
};

export default DataTable; 