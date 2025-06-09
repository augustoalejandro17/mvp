import api from '../utils/api-client';

export interface UsageSummaryData {
  period: string;
  totalStorageUsed: number;
  totalStorageLimit: number;
  totalStreamingUsed: number;
  totalStreamingLimit: number;
  storageOverage: number;
  streamingOverage: number;
  storageCost: number;
  streamingCost: number;
  totalCost: number;
  storageByType: {
    video: number;
    image: number;
    document: number;
    audio: number;
    other: number;
  };
  topStreamingSessions: Array<{
    assetId: string;
    duration: number;
    bytesTransferred: number;
    quality: string;
    createdAt: string;
  }>;
}

export interface MonthlyUsageData {
  schoolId: string;
  schoolName: string;
  month: string;
  year: number;
  totalStorageUsed: number;
  totalStreamingUsed: number;
  storageOverage: number;
  streamingOverage: number;
  totalCost: number;
}

export interface StreamingSessionData {
  sessionId: string;
  assetId: string;
  schoolId: string;
  userId: string;
  duration: number;
  bytesTransferred: number;
  quality: string;
  deviceType: string;
  startTime: string;
  endTime?: string;
  isActive: boolean;
}

class UsageTrackingService {
  /**
   * Get usage summary for a school
   */
  async getUsageSummary(
    schoolId: string,
    month?: number,
    year?: number
  ): Promise<UsageSummaryData> {
    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month.toString());
      if (year) params.append('year', year.toString());
      
      const queryString = params.toString();
      const url = `/api/usage/school/${schoolId}/summary${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url);
      
      // Ensure all required fields are present with defaults
      const data = response.data || {};
      return {
        period: data.period || `${month || new Date().getMonth() + 1}/${year || new Date().getFullYear()}`,
        totalStorageUsed: data.totalStorageUsed || 0,
        totalStorageLimit: data.totalStorageLimit || 0,
        totalStreamingUsed: data.totalStreamingUsed || 0,
        totalStreamingLimit: data.totalStreamingLimit || 0,
        storageOverage: data.storageOverage || 0,
        streamingOverage: data.streamingOverage || 0,
        storageCost: data.storageCost || 0,
        streamingCost: data.streamingCost || 0,
        totalCost: data.totalCost || 0,
        storageByType: data.storageByType || {
          video: 0,
          image: 0,
          document: 0,
          audio: 0,
          other: 0,
        },
        topStreamingSessions: data.topStreamingSessions || [],
      };
    } catch (error) {
      console.error('Error fetching usage summary:', error);
      throw error;
    }
  }

  /**
   * Get monthly usage data for schools (using overages endpoint as fallback)
   */
  async getMonthlyUsage(
    schoolId?: string,
    year?: number,
    month?: number
  ): Promise<MonthlyUsageData[]> {
    try {
      const params = new URLSearchParams();
      if (year) params.append('year', year.toString());
      if (month) params.append('month', month.toString());
      
      const queryString = params.toString();
      const url = `/api/usage/schools/overages${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching monthly usage:', error);
      throw error;
    }
  }

  /**
   * Start a streaming session
   */
  async startStreamingSession(data: {
    assetId: string;
    schoolId: string;
    relatedCourse?: string;
    relatedClass?: string;
    quality?: 'low' | 'medium' | 'high';
    deviceType?: 'mobile' | 'desktop' | 'tablet';
  }): Promise<{ sessionId: string }> {
    try {
      const response = await api.post('/api/usage/streaming/start', data);
      return response.data;
    } catch (error) {
      console.error('Error starting streaming session:', error);
      throw error;
    }
  }

  /**
   * End a streaming session
   */
  async endStreamingSession(sessionId: string, bytesTransferred?: number): Promise<void> {
    try {
      await api.post(`/api/usage/streaming/end/${sessionId}`, {
        bytesTransferred
      });
    } catch (error) {
      console.error('Error ending streaming session:', error);
      throw error;
    }
  }

  /**
   * Get active streaming sessions for a school
   */
  async getActiveStreamingSessions(schoolId: string): Promise<StreamingSessionData[]> {
    try {
      const response = await api.get(`/api/usage/streaming/active/${schoolId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching active streaming sessions:', error);
      throw error;
    }
  }

  /**
   * Get streaming sessions history
   */
  async getStreamingHistory(
    schoolId: string,
    startDate?: string,
    endDate?: string,
    limit: number = 50
  ): Promise<StreamingSessionData[]> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', limit.toString());
      
      const queryString = params.toString();
      const url = `/api/usage/streaming/history/${schoolId}?${queryString}`;
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching streaming history:', error);
      throw error;
    }
  }

  /**
   * Finalize monthly usage (admin only)
   */
  async finalizeMonthlyUsage(
    schoolId: string,
    month: number,
    year: number
  ): Promise<void> {
    try {
      await api.post('/api/usage/admin/finalize-month', {
        month,
        year
      });
    } catch (error) {
      console.error('Error finalizing monthly usage:', error);
      throw error;
    }
  }

  /**
   * Cleanup stale sessions (admin only)
   */
  async cleanupStaleSessions(): Promise<void> {
    try {
      await api.post('/api/usage/admin/cleanup-stale-sessions');
    } catch (error) {
      console.error('Error cleaning up stale sessions:', error);
      throw error;
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Format duration in seconds to human readable format
   */
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Calculate usage percentage
   */
  getUsagePercentage(used: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  }

  /**
   * Get usage status color
   */
  getUsageStatusColor(percentage: number): string {
    if (percentage >= 90) return '#ef4444'; // red
    if (percentage >= 75) return '#f59e0b'; // yellow
    return '#10b981'; // green
  }
}

export default new UsageTrackingService(); 