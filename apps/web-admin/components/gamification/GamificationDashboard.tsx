import React, { useState, useEffect } from 'react';
import Badge, { BadgeData } from './Badge';
import ProgressBar, { ProgressData } from './ProgressBar';
import Leaderboard, { LeaderboardEntry } from './Leaderboard';

interface UserStats {
  totalPoints: number;
  availablePoints: number;
  level: number;
  levelInfo: {
    level: number;
    name: string;
    minPoints: number;
    maxPoints: number;
    benefits: string[];
    badgeUrl?: string;
  };
  pointsToNextLevel: number;
  streak: number;
  longestStreak: number;
  rank: number;
  schoolRank: number;
  badges: {
    total: number;
    completed: number;
    inProgress: number;
    completionRate: number;
  };
}

interface GamificationDashboardProps {
  userId: string;
  schoolId: string;
  userStats?: UserStats;
  userBadges?: BadgeData[];
  leaderboardEntries?: LeaderboardEntry[];
  loading?: boolean;
  onBadgeClick?: (badge: BadgeData) => void;
  onUserClick?: (userId: string) => void;
  className?: string;
}

const GamificationDashboard: React.FC<GamificationDashboardProps> = ({
  userId,
  schoolId,
  userStats,
  userBadges = [],
  leaderboardEntries = [],
  loading = false,
  onBadgeClick,
  onUserClick,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'leaderboard'>('overview');
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'earned' | 'inProgress'>('all');

  const filteredBadges = userBadges.filter(badge => {
    if (badgeFilter === 'earned') return badge.isEarned;
    if (badgeFilter === 'inProgress') return !badge.isEarned;
    return true;
  });

  const earnedBadges = userBadges.filter(badge => badge.isEarned);
  const inProgressBadges = userBadges.filter(badge => !badge.isEarned);

  const levelProgress: ProgressData = userStats ? {
    current: userStats.totalPoints - userStats.levelInfo.minPoints,
    target: userStats.levelInfo.maxPoints - userStats.levelInfo.minPoints,
    label: `Level ${userStats.level}: ${userStats.levelInfo.name}`,
    color: '#3B82F6',
    showPercentage: true,
    showNumbers: true,
    animated: true,
  } : {
    current: 0,
    target: 100,
    label: 'Loading...',
  };

  const TabButton: React.FC<{ 
    tab: typeof activeTab; 
    children: React.ReactNode; 
    count?: number;
  }> = ({ tab, children, count }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`
        flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-all duration-200
        ${activeTab === tab 
          ? 'bg-blue-500 text-white shadow-md' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      `}
      aria-pressed={activeTab === tab}
    >
      <span className="flex items-center justify-center space-x-2">
        <span>{children}</span>
        {count !== undefined && (
          <span className={`
            text-xs px-2 py-0.5 rounded-full
            ${activeTab === tab ? 'bg-blue-400 text-blue-100' : 'bg-gray-200 text-gray-600'}
          `}>
            {count}
          </span>
        )}
      </span>
    </button>
  );

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Stats */}
      {userStats && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Your Progress</h2>
              <p className="text-blue-100">Keep up the great work! 🎉</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{userStats.totalPoints.toLocaleString()}</div>
              <div className="text-blue-100 text-sm">Total Points</div>
            </div>
          </div>

          {/* Level Progress */}
          <div className="mb-4">
            <ProgressBar 
              progress={levelProgress}
              size="large"
              className="text-white"
            />
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{userStats.level}</div>
              <div className="text-blue-100 text-sm">Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{userStats.badges.completed}</div>
              <div className="text-blue-100 text-sm">Badges</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{userStats.streak}</div>
              <div className="text-blue-100 text-sm">Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">#{userStats.schoolRank}</div>
              <div className="text-blue-100 text-sm">Rank</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex space-x-2">
          <TabButton tab="overview">📊 Overview</TabButton>
          <TabButton tab="badges" count={earnedBadges.length}>
            🎖️ Badges
          </TabButton>
          <TabButton tab="leaderboard">🏆 Leaderboard</TabButton>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Recent Achievements */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                🎉 Recent Achievements
              </h3>
              
              {earnedBadges.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  {earnedBadges.slice(0, 6).map((badge) => (
                    <Badge
                      key={badge.id}
                      badge={badge}
                      size="medium"
                      onClick={() => onBadgeClick?.(badge)}
                      className="mx-auto"
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-4">🎖️</div>
                  <p>No badges earned yet.</p>
                  <p className="text-sm mt-2">Complete activities to earn your first badge!</p>
                </div>
              )}
            </div>

            {/* Progress Tracking */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                📈 Progress Tracking
              </h3>
              
              <div className="space-y-4">
                {inProgressBadges.slice(0, 3).map((badge) => (
                  <div key={badge.id} className="flex items-center space-x-4">
                    <Badge 
                      badge={badge} 
                      size="small" 
                      showProgress={false}
                      onClick={() => onBadgeClick?.(badge)}
                    />
                    <div className="flex-1">
                      <ProgressBar
                        progress={{
                          current: badge.progress?.current || 0,
                          target: badge.progress?.required || 1,
                          label: badge.name,
                          showPercentage: true,
                          showNumbers: true,
                        }}
                        size="small"
                        onClick={() => onBadgeClick?.(badge)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Your Badges</h3>
              
              {/* Badge Filter */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                {(['all', 'earned', 'inProgress'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setBadgeFilter(filter)}
                    className={`
                      px-3 py-1 text-xs font-medium rounded-md transition-all duration-200
                      ${badgeFilter === filter 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                      }
                    `}
                  >
                    {filter === 'all' && 'All'}
                    {filter === 'earned' && 'Earned'}
                    {filter === 'inProgress' && 'In Progress'}
                  </button>
                ))}
              </div>
            </div>

            {/* Badge Grid */}
            {filteredBadges.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {filteredBadges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center">
                    <Badge
                      badge={badge}
                      size="large"
                      onClick={() => onBadgeClick?.(badge)}
                    />
                    <p className="text-xs text-center mt-2 text-gray-600 font-medium">
                      {badge.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <div className="text-4xl mb-4">🎖️</div>
                <p>No badges in this category yet.</p>
                <p className="text-sm mt-2">
                  {badgeFilter === 'earned' && 'Start completing activities to earn badges!'}
                  {badgeFilter === 'inProgress' && 'All available badges have been earned!'}
                  {badgeFilter === 'all' && 'No badges available at the moment.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <Leaderboard
            entries={leaderboardEntries}
            currentUserId={userId}
            title="Leaderboard"
            period="monthly"
            type="school"
            onUserClick={onUserClick}
          />
        )}
      </div>
    </div>
  );
};

export default GamificationDashboard; 