import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/UsageDashboard.module.css';
import UsageTrackingService, { UsageSummaryData, MonthlyUsageData } from '../UsageTrackingService';
import UsageOverviewCards from './UsageOverviewCards';
import UsageChart from './UsageChart';
import StorageBreakdown from './StorageBreakdown';
import StreamingSessionsTable from './StreamingSessionsTable';
import OverageAlert from './OverageAlert';

interface UsageDashboardProps {
  schoolId: string;
  schoolName?: string;
  userRole?: string;
}

const UsageDashboard: React.FC<UsageDashboardProps> = ({ 
  schoolId, 
  schoolName,
  userRole 
}) => {
  const [usageSummary, setUsageSummary] = useState<UsageSummaryData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyUsageData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsageData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch current period summary
      const summary = await UsageTrackingService.getUsageSummary(
        schoolId,
        selectedPeriod.month,
        selectedPeriod.year
      );
      
      // Ensure summary has all required fields with defaults
      const completeSummary = {
        period: summary.period || `${selectedPeriod.month}/${selectedPeriod.year}`,
        totalStorageUsed: summary.totalStorageUsed || 0,
        totalStorageLimit: summary.totalStorageLimit || 0,
        totalStreamingUsed: summary.totalStreamingUsed || 0,
        totalStreamingLimit: summary.totalStreamingLimit || 0,
        storageOverage: summary.storageOverage || 0,
        streamingOverage: summary.streamingOverage || 0,
        storageCost: summary.storageCost || 0,
        streamingCost: summary.streamingCost || 0,
        totalCost: summary.totalCost || 0,
        storageByType: summary.storageByType || {
          video: 0,
          image: 0,
          document: 0,
          audio: 0,
          other: 0,
        },
        topStreamingSessions: summary.topStreamingSessions || [],
      };
      
      setUsageSummary(completeSummary);

      // Fetch last 6 months of data for trending
      const monthlyData = await UsageTrackingService.getMonthlyUsage(
        schoolId,
        selectedPeriod.year
      );
      setMonthlyData(monthlyData || []);

    } catch (error) {
      console.error('Error fetching usage data:', error);
      setError('Error al cargar los datos de uso. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedPeriod]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsageData();
    setRefreshing(false);
  };

  const handlePeriodChange = (period: { month: number; year: number }) => {
    setSelectedPeriod(period);
  };

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando datos de uso...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorMessage}>{error}</p>
        <button onClick={handleRefresh} className={styles.retryButton}>
          Reintentar
        </button>
      </div>
    );
  }

  const hasOverage = usageSummary && (
    usageSummary.storageOverage > 0 || usageSummary.streamingOverage > 0
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>
            Uso de Recursos
            {schoolName && <span className={styles.schoolName}>- {schoolName}</span>}
          </h1>
          <div className={styles.headerControls}>
            <select
              value={`${selectedPeriod.year}-${selectedPeriod.month.toString().padStart(2, '0')}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-');
                handlePeriodChange({
                  year: parseInt(year),
                  month: parseInt(month)
                });
              }}
              className={styles.periodSelector}
            >
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const monthName = date.toLocaleDateString('es-ES', { 
                  month: 'long', 
                  year: 'numeric' 
                });
                return (
                  <option 
                    key={`${year}-${month}`} 
                    value={`${year}-${month.toString().padStart(2, '0')}`}
                  >
                    {monthName}
                  </option>
                );
              })}
            </select>
            <button 
              onClick={handleRefresh} 
              disabled={refreshing}
              className={styles.refreshButton}
            >
              {refreshing ? (
                <>
                  <span className={styles.spinner}></span>
                  Actualizando...
                </>
              ) : (
                <>
                  🔄 Actualizar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Overage Alert */}
      {hasOverage && usageSummary && (
        <OverageAlert 
          storageOverage={usageSummary.storageOverage}
          streamingOverage={usageSummary.streamingOverage}
          storageCost={usageSummary.storageCost}
          streamingCost={usageSummary.streamingCost}
          totalCost={usageSummary.totalCost}
        />
      )}

      {/* Main Content */}
      <div className={styles.content}>
        {usageSummary && (
          <>
            {/* Overview Cards */}
            <UsageOverviewCards usageSummary={usageSummary} />

            {/* Charts and Breakdown */}
            <div className={styles.chartsRow}>
              <div className={styles.chartContainer}>
                <UsageChart 
                  monthlyData={monthlyData}
                  currentMonth={selectedPeriod}
                />
              </div>
              <div className={styles.breakdownContainer}>
                <StorageBreakdown 
                  storageByType={usageSummary.storageByType}
                  totalStorage={usageSummary.totalStorageUsed}
                />
              </div>
            </div>

            {/* Streaming Sessions */}
            <div className={styles.sessionsContainer}>
              <StreamingSessionsTable 
                schoolId={schoolId}
                topSessions={usageSummary.topStreamingSessions}
                showFullHistory={true}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UsageDashboard; 