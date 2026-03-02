import React from 'react';
import styles from '../../styles/UsageComponents.module.css';
import UsageTrackingService from '../UsageTrackingService';

interface OverageAlertProps {
  storageOverage: number;
  streamingOverage: number;
  storageCost: number;
  streamingCost: number;
  totalCost: number;
}

const OverageAlert: React.FC<OverageAlertProps> = ({
  storageOverage,
  streamingOverage,
  storageCost,
  streamingCost,
  totalCost
}) => {
  const hasStorageOverage = storageOverage > 0;
  const hasStreamingOverage = streamingOverage > 0;
  const hasAnyOverage = hasStorageOverage || hasStreamingOverage;

  if (!hasAnyOverage) return null;

  const alertLevel = totalCost > 50 ? 'critical' : totalCost > 20 ? 'warning' : 'info';

  return (
    <div className={`${styles.overageAlert} ${styles[alertLevel]}`}>
      <div className={styles.alertHeader}>
        <div className={styles.alertIcon}>
          {alertLevel === 'critical' ? '🚨' : alertLevel === 'warning' ? '⚠️' : 'ℹ️'}
        </div>
        <div className={styles.alertTitle}>
          <h3>
            {alertLevel === 'critical' 
              ? 'Exceso Crítico Detectado' 
              : alertLevel === 'warning' 
              ? 'Advertencia de Exceso' 
              : 'Exceso de Uso'}
          </h3>
          <p className={styles.alertSubtitle}>
            Has superado los límites de tu plan. Se aplicarán cargos adicionales.
          </p>
        </div>
        <div className={styles.alertCost}>
          <span className={styles.costLabel}>Costo Adicional:</span>
          <span className={styles.costAmount}>
            {UsageTrackingService.formatCurrency(totalCost)}
          </span>
        </div>
      </div>

      <div className={styles.alertContent}>
        <div className={styles.overageDetails}>
          {hasStorageOverage && (
            <div className={styles.overageItem}>
              <div className={styles.overageType}>
                <span className={styles.overageIcon}>💾</span>
                <span className={styles.overageLabel}>Almacenamiento</span>
              </div>
              <div className={styles.overageAmount}>
                <span className={styles.overageSize}>
                  +{UsageTrackingService.formatBytes(storageOverage)}
                </span>
                <span className={styles.overageCostValue}>
                  {UsageTrackingService.formatCurrency(storageCost)}
                </span>
              </div>
            </div>
          )}

          {hasStreamingOverage && (
            <div className={styles.overageItem}>
              <div className={styles.overageType}>
                <span className={styles.overageIcon}>🎥</span>
                <span className={styles.overageLabel}>Streaming</span>
              </div>
              <div className={styles.overageAmount}>
                <span className={styles.overageSize}>
                  +{UsageTrackingService.formatBytes(streamingOverage)}
                </span>
                <span className={styles.overageCostValue}>
                  {UsageTrackingService.formatCurrency(streamingCost)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.alertActions}>
          <div className={styles.recommendations}>
            <h4>💡 Recomendaciones:</h4>
            <ul>
              {hasStorageOverage && (
                <>
                  <li>Elimina archivos antiguos o innecesarios para reducir el almacenamiento</li>
                  <li>Considera comprimir videos e imágenes antes de subirlos</li>
                </>
              )}
              {hasStreamingOverage && (
                <>
                  <li>Reduce la calidad de streaming cuando sea posible</li>
                  <li>Limita el acceso simultáneo de usuarios durante horas pico</li>
                </>
              )}
              <li>Considera actualizar a un plan superior para aumentar tus límites</li>
              <li>Revisa el uso regularmente para evitar excesos futuros</li>
            </ul>
          </div>

          <div className={styles.actionButtons}>
            <button className={styles.primaryButton}>
              Ver Planes Superiores
            </button>
            <button className={styles.secondaryButton}>
              Gestionar Archivos
            </button>
          </div>
        </div>
      </div>

      {/* Progress indicator for overage severity */}
      <div className={styles.overageSeverity}>
        <div className={styles.severityBar}>
          <div 
            className={`${styles.severityFill} ${styles[alertLevel]}`}
            style={{ 
              width: `${Math.min((totalCost / 100) * 100, 100)}%`
            }}
          />
        </div>
        <div className={styles.severityLabels}>
          <span className={styles.severityLabel}>Leve</span>
          <span className={styles.severityLabel}>Moderado</span>
          <span className={styles.severityLabel}>Alto</span>
          <span className={styles.severityLabel}>Crítico</span>
        </div>
      </div>
    </div>
  );
};

export default OverageAlert; 