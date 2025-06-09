import React from 'react';
import styles from '../../styles/UsageComponents.module.css';
import UsageTrackingService from '../UsageTrackingService';

interface StorageBreakdownProps {
  storageByType: {
    video: number;
    image: number;
    document: number;
    audio: number;
    other: number;
  };
  totalStorage: number;
}

const StorageBreakdown: React.FC<StorageBreakdownProps> = ({ 
  storageByType, 
  totalStorage 
}) => {
  const typeLabels = {
    video: { label: 'Videos', icon: '🎥', color: '#3b82f6' },
    image: { label: 'Imágenes', icon: '🖼️', color: '#10b981' },
    document: { label: 'Documentos', icon: '📄', color: '#f59e0b' },
    audio: { label: 'Audio', icon: '🎵', color: '#8b5cf6' },
    other: { label: 'Otros', icon: '📦', color: '#6b7280' }
  };

  const storageData = Object.entries(storageByType)
    .map(([type, size]) => ({
      type: type as keyof typeof typeLabels,
      size,
      percentage: totalStorage > 0 ? (size / totalStorage) * 100 : 0,
      ...typeLabels[type as keyof typeof typeLabels]
    }))
    .filter(item => item.size > 0)
    .sort((a, b) => b.size - a.size);

  return (
    <div className={styles.storageBreakdown}>
      <div className={styles.breakdownHeader}>
        <h3 className={styles.breakdownTitle}>💾 Desglose de Almacenamiento</h3>
        <span className={styles.totalSize}>
          Total: {UsageTrackingService.formatBytes(totalStorage * 1024 * 1024 * 1024)}
        </span>
      </div>

      <div className={styles.breakdownContent}>
        {storageData.length > 0 ? (
          <>
            {/* Pie Chart Visual */}
            <div className={styles.pieChart}>
              <svg viewBox="0 0 100 100" className={styles.pieChartSvg}>
                {(() => {
                  let currentAngle = 0;
                  return storageData.map((item, index) => {
                    const angle = (item.percentage / 100) * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;
                    currentAngle += angle;

                    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                    const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                    const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

                    const largeArcFlag = angle > 180 ? 1 : 0;

                    return (
                      <g key={item.type}>
                        <path
                          d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                          fill={item.color}
                          className={styles.pieSlice}
                        />
                        <title>{`${item.label}: ${item.percentage.toFixed(1)}%`}</title>
                      </g>
                    );
                  });
                })()}
              </svg>
            </div>

            {/* Storage Type List */}
            <div className={styles.storageList}>
              {storageData.map((item) => (
                <div key={item.type} className={styles.storageItem}>
                  <div className={styles.storageItemHeader}>
                    <div className={styles.storageItemInfo}>
                      <span className={styles.storageIcon}>{item.icon}</span>
                      <span className={styles.storageLabel}>{item.label}</span>
                    </div>
                    <div className={styles.storageItemValues}>
                      <span className={styles.storageSize}>
                        {UsageTrackingService.formatBytes(item.size * 1024 * 1024 * 1024)}
                      </span>
                      <span 
                        className={styles.storagePercentage}
                        style={{ color: item.color }}
                      >
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className={styles.storageItemBar}>
                    <div 
                      className={styles.storageItemProgress}
                      style={{ 
                        width: `${item.percentage}%`,
                        backgroundColor: item.color 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.noStorageData}>
            <div className={styles.noDataIcon}>📭</div>
            <p className={styles.noDataText}>No hay datos de almacenamiento disponibles</p>
            <p className={styles.noDataSubtext}>
              Los archivos aparecerán aquí cuando comiences a subir contenido
            </p>
          </div>
        )}
      </div>

      {/* Storage Tips */}
      {storageData.length > 0 && (
        <div className={styles.storageTips}>
          <h4 className={styles.tipsTitle}>💡 Consejos para optimizar almacenamiento:</h4>
          <ul className={styles.tipsList}>
            {storageData[0]?.type === 'video' && (
              <li>Los videos ocupan más espacio. Considera comprimirlos antes de subir.</li>
            )}
            {storageData.some(item => item.type === 'image' && item.percentage > 30) && (
              <li>Optimiza las imágenes reduciendo su resolución para el uso web.</li>
            )}
            {storageData.length > 3 && (
              <li>Organiza y elimina archivos antiguos que ya no necesites.</li>
            )}
            <li>Revisa periódicamente tu uso de almacenamiento para evitar excesos.</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default StorageBreakdown; 