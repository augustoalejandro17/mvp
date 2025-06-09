import React from 'react';
import styles from '../../styles/UsageComponents.module.css';
import UsageTrackingService from '../UsageTrackingService';
import { UsageSummaryData } from '../UsageTrackingService';

interface UsageOverviewCardsProps {
  usageSummary: UsageSummaryData;
}

const UsageOverviewCards: React.FC<UsageOverviewCardsProps> = ({ usageSummary }) => {
  const storagePercentage = UsageTrackingService.getUsagePercentage(
    usageSummary.totalStorageUsed,
    usageSummary.totalStorageLimit
  );

  const streamingPercentage = UsageTrackingService.getUsagePercentage(
    usageSummary.totalStreamingUsed,
    usageSummary.totalStreamingLimit
  );

  const storageColor = UsageTrackingService.getUsageStatusColor(storagePercentage);
  const streamingColor = UsageTrackingService.getUsageStatusColor(streamingPercentage);

  return (
    <div className={styles.overviewCards}>
      {/* Storage Usage Card */}
      <div className={styles.usageCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>💾 Almacenamiento</h3>
          <span className={styles.cardPeriod}>{usageSummary.period}</span>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.usageAmount}>
            <span className={styles.mainNumber}>
              {UsageTrackingService.formatBytes(usageSummary.totalStorageUsed * 1024 * 1024 * 1024)}
            </span>
            <span className={styles.limitText}>
              de {UsageTrackingService.formatBytes(usageSummary.totalStorageLimit * 1024 * 1024 * 1024)}
            </span>
          </div>
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ 
                  width: `${storagePercentage}%`,
                  backgroundColor: storageColor
                }}
              />
            </div>
            <span 
              className={styles.percentageText}
              style={{ color: storageColor }}
            >
              {storagePercentage.toFixed(1)}%
            </span>
          </div>
          {usageSummary.storageOverage > 0 && (
            <div className={styles.overageWarning}>
              <span className={styles.overageIcon}>⚠️</span>
              <span className={styles.overageText}>
                Exceso: {UsageTrackingService.formatBytes(usageSummary.storageOverage * 1024 * 1024 * 1024)}
              </span>
              <span className={styles.overageCost}>
                {UsageTrackingService.formatCurrency(usageSummary.storageCost)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Streaming Usage Card */}
      <div className={styles.usageCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>🎥 Streaming</h3>
          <span className={styles.cardPeriod}>{usageSummary.period}</span>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.usageAmount}>
            <span className={styles.mainNumber}>
              {UsageTrackingService.formatBytes(usageSummary.totalStreamingUsed * 1024 * 1024 * 1024)}
            </span>
            <span className={styles.limitText}>
              de {UsageTrackingService.formatBytes(usageSummary.totalStreamingLimit * 60 * 125000)}
            </span>
          </div>
          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ 
                  width: `${streamingPercentage}%`,
                  backgroundColor: streamingColor
                }}
              />
            </div>
            <span 
              className={styles.percentageText}
              style={{ color: streamingColor }}
            >
              {streamingPercentage.toFixed(1)}%
            </span>
          </div>
          {usageSummary.streamingOverage > 0 && (
            <div className={styles.overageWarning}>
              <span className={styles.overageIcon}>⚠️</span>
              <span className={styles.overageText}>
                Exceso: {UsageTrackingService.formatDuration(usageSummary.streamingOverage * 60)}
              </span>
              <span className={styles.overageCost}>
                {UsageTrackingService.formatCurrency(usageSummary.streamingCost)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Total Cost Card */}
      <div className={styles.usageCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>💰 Costo Total</h3>
          <span className={styles.cardPeriod}>{usageSummary.period}</span>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.costBreakdown}>
            <div className={styles.costItem}>
              <span className={styles.costLabel}>Plan Base:</span>
              <span className={styles.costValue}>Incluido</span>
            </div>
            {usageSummary.storageCost > 0 && (
              <div className={styles.costItem}>
                <span className={styles.costLabel}>Exceso Almacenamiento:</span>
                <span className={styles.costValue}>
                  {UsageTrackingService.formatCurrency(usageSummary.storageCost)}
                </span>
              </div>
            )}
            {usageSummary.streamingCost > 0 && (
              <div className={styles.costItem}>
                <span className={styles.costLabel}>Exceso Streaming:</span>
                <span className={styles.costValue}>
                  {UsageTrackingService.formatCurrency(usageSummary.streamingCost)}
                </span>
              </div>
            )}
            <div className={styles.totalCost}>
              <span className={styles.totalLabel}>Total:</span>
              <span className={styles.totalValue}>
                {UsageTrackingService.formatCurrency(usageSummary.totalCost)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Card */}
      <div className={styles.usageCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>📊 Estadísticas</h3>
          <span className={styles.cardPeriod}>{usageSummary.period}</span>
        </div>
        <div className={styles.cardContent}>
          <div className={styles.quickStats}>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>🎬</span>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {usageSummary.topStreamingSessions?.length || 0}
                </span>
                <span className={styles.statLabel}>Sesiones Activas</span>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>📁</span>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {Object.values(usageSummary.storageByType || {}).reduce(
                    (acc, val) => acc + (val > 0 ? 1 : 0), 0
                  )}
                </span>
                <span className={styles.statLabel}>Tipos de Archivo</span>
              </div>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statIcon}>⏱️</span>
              <div className={styles.statContent}>
                <span className={styles.statNumber}>
                  {UsageTrackingService.formatDuration(
                    (usageSummary.topStreamingSessions || []).reduce(
                      (acc, session) => acc + session.duration, 0
                    )
                  )}
                </span>
                <span className={styles.statLabel}>Tiempo Total</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageOverviewCards; 