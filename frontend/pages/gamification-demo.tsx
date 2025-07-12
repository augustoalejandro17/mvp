import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import Badge from '../components/gamification/Badge';
import ProgressBar from '../components/gamification/ProgressBar';
import Leaderboard from '../components/gamification/Leaderboard';

export default function GamificationDemo() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'points' | 'badges' | 'leaderboard' | 'progress'>('points');

  // Simulated user data
  const userStats = {
    totalPoints: 1250,
    level: 3,
    levelName: 'Scholar',
    pointsToNextLevel: 250,
    currentLevelPoints: 1000,
    nextLevelPoints: 1500,
    streak: 12,
    rank: 3,
    schoolRank: 1,
  };

  // Simulated badges
  const badges = [
    {
      id: '1',
      name: 'First Login',
      description: 'Welcome to the platform!',
      iconUrl: '',
      type: 'engagement' as const,
      rarity: 'common' as const,
      pointsReward: 10,
      isEarned: true,
      earnedAt: new Date('2025-07-10'),
      progress: { current: 1, required: 1, percentage: 100 },
    },
    {
      id: '2',
      name: 'Video Watcher',
      description: 'Watch 5 videos',
      iconUrl: '',
      type: 'video_watching' as const,
      rarity: 'rare' as const,
      pointsReward: 25,
      isEarned: false,
      progress: { current: 3, required: 5, percentage: 60 },
    },
    {
      id: '3',
      name: 'Perfect Attendance',
      description: 'Attend 10 classes in a row',
      iconUrl: '',
      type: 'attendance' as const,
      rarity: 'epic' as const,
      pointsReward: 50,
      isEarned: true,
      earnedAt: new Date('2025-07-11'),
      progress: { current: 10, required: 10, percentage: 100 },
    },
    {
      id: '4',
      name: 'Assignment Master',
      description: 'Complete 20 assignments',
      iconUrl: '',
      type: 'completion' as const,
      rarity: 'legendary' as const,
      pointsReward: 100,
      isEarned: false,
      progress: { current: 7, required: 20, percentage: 35 },
    },
  ];

  // Simulated leaderboard
  const leaderboard = [
    {
      userId: '2',
      userName: 'María García',
      userAvatar: '',
      points: 1380,
      level: 3,
      rank: 1,
      badges: 12,
      streak: 15,
      lastActivity: new Date(),
      isActive: true,
      specialTitles: [],
      rankChange: 1,
    },
    {
      userId: '3',
      userName: 'Carlos López',
      userAvatar: '',
      points: 1290,
      level: 3,
      rank: 2,
      badges: 10,
      streak: 8,
      lastActivity: new Date(),
      isActive: true,
      specialTitles: [],
      rankChange: 0,
    },
    {
      userId: '1',
      userName: session?.user?.name || 'Augusto Vaca',
      userAvatar: '',
      points: 1250,
      level: 3,
      rank: 3,
      badges: 8,
      streak: 12,
      lastActivity: new Date(),
      isActive: true,
      specialTitles: [],
      rankChange: -1,
    },
    {
      userId: '4',
      userName: 'Ana Rodríguez',
      userAvatar: '',
      points: 1180,
      level: 2,
      rank: 4,
      badges: 9,
      streak: 6,
      lastActivity: new Date(),
      isActive: true,
      specialTitles: [],
      rankChange: 0,
    },
    {
      userId: '5',
      userName: 'Luis Mendoza',
      userAvatar: '',
      points: 1050,
      level: 2,
      rank: 5,
      badges: 7,
      streak: 20,
      lastActivity: new Date(),
      isActive: true,
      specialTitles: [],
      rankChange: 0,
    },
  ];

  const getLevelProgress = () => {
    const current = userStats.totalPoints - userStats.currentLevelPoints;
    const total = userStats.nextLevelPoints - userStats.currentLevelPoints;
    return { current, total, percentage: Math.round((current / total) * 100) };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🎮 Gamification Demo - Live Features
          </h1>
          <p className="text-gray-600">
            Here you can see all gamification features in action with interactive components.
          </p>
        </div>

        {/* User Stats Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">Welcome back, {session?.user?.name || 'Augusto'}! 👋</h2>
              <p className="text-blue-100">You're doing great! Keep up the momentum.</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{userStats.totalPoints.toLocaleString()}</div>
              <div className="text-blue-100 text-sm">Total Points</div>
            </div>
          </div>

          {/* Level ProgressBar */}
          <div className="mb-4">
            <ProgressBar
              progress={{
                current: userStats.totalPoints - userStats.currentLevelPoints,
                target: userStats.nextLevelPoints - userStats.currentLevelPoints,
                label: `Level ${userStats.level}: ${userStats.levelName}`,
                color: '#3B82F6',
                showPercentage: true,
                showNumbers: true,
                animated: true,
              }}
              size="large"
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{userStats.level}</div>
              <div className="text-blue-100 text-sm">Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{badges.filter(b => b.isEarned).length}</div>
              <div className="text-blue-100 text-sm">Badges</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{userStats.streak} 🔥</div>
              <div className="text-blue-100 text-sm">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">#{userStats.schoolRank}</div>
              <div className="text-blue-100 text-sm">School Rank</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            {[
              { key: 'points', label: '🎯 Points & Levels', count: userStats.totalPoints },
              { key: 'badges', label: '🏆 Badges', count: badges.filter(b => b.isEarned).length },
              { key: 'leaderboard', label: '📊 Leaderboard', count: userStats.schoolRank },
              { key: 'progress', label: '📈 Progress', count: null },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center justify-center space-x-2">
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Points & Levels Tab */}
          {activeTab === 'points' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold mb-4">🎯 Points System</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">How to Earn Points</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>📹 Watch videos</span>
                        <span className="font-medium">2 pts/min</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>📅 Attend classes</span>
                        <span className="font-medium">10-15 pts</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>📝 Complete assignments</span>
                        <span className="font-medium">15-25 pts</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>🎓 Finish courses</span>
                        <span className="font-medium">100 pts</span>
                      </div>
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>🔥 Weekly streaks</span>
                        <span className="font-medium">10 pts</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Level Progress</h4>
                    <ProgressBar
                      progress={{
                        current: userStats.totalPoints - userStats.currentLevelPoints,
                        target: userStats.nextLevelPoints - userStats.currentLevelPoints,
                        label: `Level ${userStats.level}: ${userStats.levelName}`,
                        color: '#3B82F6',
                        showPercentage: true,
                        showNumbers: true,
                        animated: true,
                      }}
                      size="large"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Badges Tab */}
          {activeTab === 'badges' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">🏆 Your Badges</h3>
                  <div className="text-sm text-gray-500">
                    {badges.filter(b => b.isEarned).length} of {badges.length} earned
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {badges.map((badge) => (
                    <Badge
                      key={badge.id}
                      badge={badge}
                      size="large"
                      showProgress={true}
                      showTooltip={true}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold mb-4">📊 Leaderboard</h3>
                <Leaderboard
                  entries={leaderboard}
                  currentUserId={'1'}
                  title="Leaderboard"
                  period="monthly"
                  type="school"
                  maxEntries={5}
                  showUserPosition={true}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 