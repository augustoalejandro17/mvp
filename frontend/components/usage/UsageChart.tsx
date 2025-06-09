import React from 'react';
import styles from '../../styles/UsageComponents.module.css';
import UsageTrackingService from '../UsageTrackingService';
import { MonthlyUsageData } from '../UsageTrackingService';

interface UsageChartProps {
  monthlyData: MonthlyUsageData[];
  currentMonth: { month: number; year: number };
}

const UsageChart: React.FC<UsageChartProps> = ({ monthlyData, currentMonth }) => {
  // Get last 6 months of data for the chart
  const chartData = React.useMemo(() => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const monthData = monthlyData.find(d => 
        `${d.year}-${d.month.padStart(2, '0')}` === monthKey
      );
      
      months.push({
        label: date.toLocaleDateString('es-ES', { month: 'short' }),
        storage: monthData?.totalStorageUsed || 0,
        streaming: monthData?.totalStreamingUsed || 0,
        cost: monthData?.totalCost || 0,
        isCurrentMonth: date.getMonth() === currentMonth.month - 1 && 
                       date.getFullYear() === currentMonth.year
      });
    }
    
    return months;
  }, [monthlyData, currentMonth]);

  // Calculate max values for scaling
  const maxStorage = Math.max(...chartData.map(d => d.storage), 1);
  const maxStreaming = Math.max(...chartData.map(d => d.streaming), 1);
  const maxCost = Math.max(...chartData.map(d => d.cost), 1);

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>📈 Tendencia de Uso (6 meses)</h3>
      </div>
      
      <div className={styles.chartContent}>
        {/* Storage Chart */}
        <div className={styles.chartSection}>
          <h4 className={styles.chartSectionTitle}>💾 Almacenamiento</h4>
          <div className={styles.barChart}>
            {chartData.map((month, index) => (
              <div key={index} className={styles.barGroup}>
                <div className={styles.barContainer}>
                  <div 
                    className={`${styles.bar} ${styles.storageBar} ${
                      month.isCurrentMonth ? styles.currentMonth : ''
                    }`}
                    style={{ 
                      height: `${(month.storage / maxStorage) * 100}%`,
                    }}
                    title={`${month.label}: ${UsageTrackingService.formatBytes(month.storage * 1024 * 1024 * 1024)}`}
                  />
                </div>
                <span className={styles.barLabel}>{month.label}</span>
                <span className={styles.barValue}>
                  {UsageTrackingService.formatBytes(month.storage * 1024 * 1024 * 1024)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Streaming Chart */}
        <div className={styles.chartSection}>
          <h4 className={styles.chartSectionTitle}>🎥 Streaming</h4>
          <div className={styles.barChart}>
            {chartData.map((month, index) => (
              <div key={index} className={styles.barGroup}>
                <div className={styles.barContainer}>
                  <div 
                    className={`${styles.bar} ${styles.streamingBar} ${
                      month.isCurrentMonth ? styles.currentMonth : ''
                    }`}
                    style={{ 
                      height: `${(month.streaming / maxStreaming) * 100}%`,
                    }}
                    title={`${month.label}: ${UsageTrackingService.formatBytes(month.streaming * 1024 * 1024 * 1024)}`}
                  />
                </div>
                <span className={styles.barLabel}>{month.label}</span>
                <span className={styles.barValue}>
                  {UsageTrackingService.formatBytes(month.streaming * 1024 * 1024 * 1024)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Chart */}
        <div className={styles.chartSection}>
          <h4 className={styles.chartSectionTitle}>💰 Costos</h4>
          <div className={styles.barChart}>
            {chartData.map((month, index) => (
              <div key={index} className={styles.barGroup}>
                <div className={styles.barContainer}>
                  <div 
                    className={`${styles.bar} ${styles.costBar} ${
                      month.isCurrentMonth ? styles.currentMonth : ''
                    }`}
                    style={{ 
                      height: `${(month.cost / maxCost) * 100}%`,
                    }}
                    title={`${month.label}: ${UsageTrackingService.formatCurrency(month.cost)}`}
                  />
                </div>
                <span className={styles.barLabel}>{month.label}</span>
                <span className={styles.barValue}>
                  {UsageTrackingService.formatCurrency(month.cost)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Legend */}
      <div className={styles.chartLegend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.storageColor}`}></div>
          <span>Almacenamiento</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.streamingColor}`}></div>
          <span>Streaming</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.costColor}`}></div>
          <span>Costos</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendColor} ${styles.currentMonthColor}`}></div>
          <span>Mes Actual</span>
        </div>
      </div>
    </div>
  );
};

export default UsageChart; 