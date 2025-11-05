import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSessionUser } from '../hooks/useSessionUser';
import { analysisApi } from '../utils/analysis-api';
import { AnalysisListItem } from '../types/bachata-analysis';

interface AnalysisStats {
  totalAnalyses: number;
  averageScore: number;
  bestScore: number;
  recentTrend: 'improving' | 'declining' | 'stable';
}

const ProgressPage: React.FC = () => {
  const router = useRouter();
  const { user, isLoading: userLoading } = useSessionUser();
  
  const [analyses, setAnalyses] = useState<AnalysisListItem[]>([]);
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, currentPage]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [analysesResponse, statsResponse] = await Promise.all([
        analysisApi.getUserAnalyses(currentPage, 10),
        analysisApi.getAnalysisStats(),
      ]);

      setAnalyses(analysesResponse.analyses);
      setTotalPages(analysesResponse.totalPages);
      setStats(statsResponse);
    } catch (err) {
      console.error('Failed to load progress data:', err);
      setError('Failed to load your progress data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisClick = async (analysisId: string) => {
    try {
      const analysis = await analysisApi.getAnalysis(analysisId);
      // For now, just log it - in a full implementation, you'd show a modal or navigate to a detail page
      console.log('Analysis details:', analysis);
      alert('Analysis details logged to console');
    } catch (err) {
      console.error('Failed to load analysis details:', err);
      alert('Failed to load analysis details');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatDuration = (durationMs: number) => {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <span className="text-green-500">↗️</span>;
      case 'declining':
        return <span className="text-red-500">↘️</span>;
      default:
        return <span className="text-gray-500">→</span>;
    }
  };

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to continue</h1>
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Progress</h1>
          <p className="text-lg text-gray-600">Track your bachata journey and improvement</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Total Sessions */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalAnalyses}</div>
              <div className="text-gray-600">Total Sessions</div>
            </div>

            {/* Average Score */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className={`text-3xl font-bold mb-2 ${getScoreColor(stats.averageScore).split(' ')[0]}`}>
                {stats.averageScore}
              </div>
              <div className="text-gray-600">Average Score</div>
            </div>

            {/* Best Score */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className={`text-3xl font-bold mb-2 ${getScoreColor(stats.bestScore).split(' ')[0]}`}>
                {stats.bestScore}
              </div>
              <div className="text-gray-600">Best Score</div>
            </div>

            {/* Trend */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="text-3xl mb-2">{getTrendIcon(stats.recentTrend)}</div>
              <div className="text-gray-600 capitalize">{stats.recentTrend}</div>
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Recent Sessions</h2>
              <button
                onClick={() => router.push('/practice')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                New Session
              </button>
            </div>
          </div>

          {analyses.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <p className="text-lg text-gray-600 mb-4">No sessions yet!</p>
              <p className="text-gray-500 mb-6">Start your bachata journey by analyzing your first dance video.</p>
              <button
                onClick={() => router.push('/practice')}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Start Your First Session
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        BPM
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Overall Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Posture
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hip Movement
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {analyses.map((analysis) => (
                      <tr key={analysis.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(analysis.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDuration(analysis.durationMs)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {analysis.bpm ? `${analysis.bpm}` : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(analysis.overallScore)}`}>
                            {analysis.overallScore}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {Math.abs(analysis.metrics.timing_ms.mean).toFixed(0)}ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {analysis.metrics.posture_deg.toFixed(1)}°
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {analysis.metrics.hip_amplitude_deg.toFixed(1)}°
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleAnalysisClick(analysis.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className={`px-3 py-1 rounded ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-1 rounded ${
                        currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressPage;
