import React, { useState, useEffect } from 'react';
import styles from '../../styles/UsageComponents.module.css';
import UsageTrackingService from '../UsageTrackingService';
import { StreamingSessionData } from '../UsageTrackingService';

interface StreamingSessionsTableProps {
  schoolId: string;
  topSessions: Array<{
    assetId: string;
    duration: number;
    bytesTransferred: number;
    quality: string;
    createdAt: string;
  }>;
  showFullHistory?: boolean;
}

const StreamingSessionsTable: React.FC<StreamingSessionsTableProps> = ({ 
  schoolId, 
  topSessions,
  showFullHistory = false 
}) => {
  const [fullSessions, setFullSessions] = useState<StreamingSessionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const fetchFullHistory = async () => {
    if (!showHistory) return;
    
    setLoading(true);
    try {
      const sessions = await UsageTrackingService.getStreamingHistory(
        schoolId,
        dateRange.startDate,
        dateRange.endDate,
        100
      );
      setFullSessions(sessions);
    } catch (error) {
      console.error('Error fetching streaming history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFullHistory();
  }, [showHistory, dateRange, schoolId]);

  const displaySessions = showHistory ? fullSessions : topSessions.map(session => ({
    sessionId: `top-${session.assetId}`,
    assetId: session.assetId,
    schoolId,
    userId: 'N/A',
    duration: session.duration,
    bytesTransferred: session.bytesTransferred,
    quality: session.quality,
    deviceType: 'unknown' as const,
    startTime: session.createdAt,
    endTime: undefined,
    isActive: false
  }));

  return (
    <div className={styles.sessionsTable}>
      <div className={styles.sessionsHeader}>
        <h3 className={styles.sessionsTitle}>🎥 Sesiones de Streaming</h3>
        {showFullHistory && (
          <div className={styles.sessionsControls}>
            <div className={styles.dateRangeControls}>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className={styles.dateInput}
              />
              <span>-</span>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className={styles.dateInput}
              />
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={styles.toggleButton}
            >
              {showHistory ? 'Ver Resumen' : 'Ver Historial Completo'}
            </button>
          </div>
        )}
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.tableLoading}>
            <div className={styles.spinner}></div>
            <p>Cargando sesiones...</p>
          </div>
        ) : displaySessions.length > 0 ? (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Duración</th>
                  <th>Datos Transferidos</th>
                  <th>Calidad</th>
                  <th>Dispositivo</th>
                  <th>Inicio</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {displaySessions.map((session, index) => (
                  <tr key={session.sessionId || index} className={styles.tableRow}>
                    <td className={styles.assetIdCell}>
                      <span className={styles.assetId} title={session.assetId}>
                        {session.assetId.length > 20 
                          ? `${session.assetId.substring(0, 20)}...` 
                          : session.assetId}
                      </span>
                    </td>
                    <td className={styles.durationCell}>
                      {UsageTrackingService.formatDuration(session.duration)}
                    </td>
                    <td className={styles.bytesCell}>
                      {UsageTrackingService.formatBytes(session.bytesTransferred)}
                    </td>
                    <td className={styles.qualityCell}>
                      <span className={`${styles.qualityBadge} ${styles[`quality${session.quality.charAt(0).toUpperCase() + session.quality.slice(1)}`]}`}>
                        {session.quality.toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.deviceCell}>
                      <span className={styles.deviceIcon}>
                        {session.deviceType === 'mobile' ? '📱' : 
                         session.deviceType === 'tablet' ? '📱' : 
                         session.deviceType === 'desktop' ? '💻' : '❓'}
                      </span>
                      <span className={styles.deviceText}>
                        {session.deviceType === 'mobile' ? 'Móvil' : 
                         session.deviceType === 'tablet' ? 'Tablet' : 
                         session.deviceType === 'desktop' ? 'Escritorio' : 'Desconocido'}
                      </span>
                    </td>
                    <td className={styles.timeCell}>
                      {new Date(session.startTime).toLocaleDateString('es-ES', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className={styles.statusCell}>
                      <span className={`${styles.statusBadge} ${
                        session.isActive ? styles.active : styles.completed
                      }`}>
                        {session.isActive ? 'Activa' : 'Completada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary Stats */}
            <div className={styles.tableSummary}>
              <div className={styles.summaryStats}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Total de Sesiones:</span>
                  <span className={styles.summaryValue}>{displaySessions.length}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Tiempo Total:</span>
                  <span className={styles.summaryValue}>
                    {UsageTrackingService.formatDuration(
                      displaySessions.reduce((acc, session) => acc + session.duration, 0)
                    )}
                  </span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Datos Totales:</span>
                  <span className={styles.summaryValue}>
                    {UsageTrackingService.formatBytes(
                      displaySessions.reduce((acc, session) => acc + session.bytesTransferred, 0)
                    )}
                  </span>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Sesiones Activas:</span>
                  <span className={styles.summaryValue}>
                    {displaySessions.filter(session => session.isActive).length}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.noSessions}>
            <div className={styles.noDataIcon}>🎬</div>
            <p className={styles.noDataText}>No hay sesiones de streaming</p>
            <p className={styles.noDataSubtext}>
              Las sesiones aparecerán aquí cuando los usuarios reproduzcan videos
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamingSessionsTable; 