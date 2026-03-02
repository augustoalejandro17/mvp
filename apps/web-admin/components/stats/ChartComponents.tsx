import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import styles from '../../styles/Stats.module.css';

// Configuraciu00f3n global de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Opciones comunes para gru00e1ficos con animaciu00f3n reducida para mejor rendimiento en mu00f3viles
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 500
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        boxWidth: 12,
        padding: 15,
        font: {
          size: 11
        }
      }
    },
  },
};

// Colores con tema consistente
const chartColors = {
  primary: 'rgba(49, 130, 206, 0.7)', // Azul
  secondary: 'rgba(72, 187, 120, 0.7)', // Verde
  tertiary: 'rgba(237, 137, 54, 0.7)', // Naranja
  quaternary: 'rgba(113, 128, 150, 0.7)', // Gris
  accent1: 'rgba(66, 153, 225, 0.7)', // Azul claro
  accent2: 'rgba(56, 178, 172, 0.7)', // Turquesa
  negative: 'rgba(229, 62, 62, 0.7)', // Rojo
};

// Componente de gru00e1fico de lu00ednea para series temporales
interface LineChartProps {
  title: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
    }>;
  };
}

export const LineChart: React.FC<LineChartProps> = ({ title, data }) => {
  // Asignar colores por defecto si no se especifican
  const enhancedData = {
    ...data,
    datasets: data.datasets.map((dataset, index) => ({
      ...dataset,
      borderColor: dataset.borderColor || Object.values(chartColors)[index % Object.values(chartColors).length],
      backgroundColor: dataset.backgroundColor || Object.values(chartColors)[index % Object.values(chartColors).length].replace('0.7', '0.1'),
      borderWidth: 2,
      tension: 0.3,
      pointRadius: window?.innerWidth < 768 ? 2 : 3,
    }))
  };

  const options = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      title: {
        display: true,
        text: title,
        font: {
          size: window?.innerWidth < 768 ? 13 : 16,
          weight: 'normal' as const
        },
        padding: { bottom: 10 }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: window?.innerWidth < 768 ? 10 : 12
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: window?.innerWidth < 768 ? 9 : 11
          },
          maxRotation: 45, // Rotar etiquetas para evitar solapamiento
          minRotation: 0
        }
      }
    }
  };

  return (
    <div className={styles.chartContainer}>
      <Line data={enhancedData} options={options} />
    </div>
  );
};

// Componente de gru00e1fico de barras para comparaciones
interface BarChartProps {
  title: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string | string[];
    }>;
  };
  horizontal?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({ title, data, horizontal = false }) => {
  // Asignar colores por defecto si no se especifican
  const enhancedData = {
    ...data,
    datasets: data.datasets.map((dataset, index) => {
      const defaultColor = Object.values(chartColors)[index % Object.values(chartColors).length];
      
      let backgroundColor;
      if (!dataset.backgroundColor) {
        backgroundColor = Array.isArray(dataset.data) 
          ? dataset.data.map((_, i) => Object.values(chartColors)[i % Object.values(chartColors).length])
          : defaultColor;
      } else {
        backgroundColor = dataset.backgroundColor;
      }

      return {
        ...dataset,
        backgroundColor,
        borderColor: dataset.borderColor || 'transparent',
        borderWidth: 1,
        borderRadius: 4,
      };
    })
  };

  const options = {
    ...commonOptions,
    indexAxis: horizontal ? 'y' as const : 'x' as const,
    plugins: {
      ...commonOptions.plugins,
      title: {
        display: true,
        text: title,
        font: {
          size: window?.innerWidth < 768 ? 13 : 16,
          weight: 'normal' as const
        },
        padding: { bottom: 10 }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: window?.innerWidth < 768 ? 10 : 12
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: window?.innerWidth < 768 ? 9 : 11
          },
          // Solo rotar etiquetas si el gru00e1fico no es horizontal
          maxRotation: horizontal ? 0 : 45,
          minRotation: 0
        }
      }
    }
  };

  return (
    <div className={styles.chartContainer}>
      <Bar data={enhancedData} options={options} />
    </div>
  );
};

// Componente de gru00e1fico circular para distribuciones
interface DoughnutChartProps {
  title: string;
  data: {
    labels: string[];
    datasets: Array<{
      data: number[];
      backgroundColor?: string[];
      borderColor?: string[];
    }>;
  };
}

export const DoughnutChart: React.FC<DoughnutChartProps> = ({ title, data }) => {
  // Asignar colores por defecto si no se especifican
  const enhancedData = {
    ...data,
    datasets: data.datasets.map(dataset => ({
      ...dataset,
      backgroundColor: dataset.backgroundColor || Object.values(chartColors),
      borderColor: dataset.borderColor || 'white',
      borderWidth: 1,
    }))
  };

  const options = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      title: {
        display: true,
        text: title,
        font: {
          size: window?.innerWidth < 768 ? 13 : 16,
          weight: 'normal' as const
        },
        padding: { bottom: 10 }
      },
    },
    cutout: '60%',
  };

  return (
    <div className={styles.chartContainer}>
      <Doughnut data={enhancedData} options={options} />
    </div>
  );
}; 