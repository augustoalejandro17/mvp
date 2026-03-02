import React, { useState } from 'react';
import Image from 'next/image';

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userAvatar?: string;
  points: number;
  level: number;
  rank: number;
  previousRank?: number;
  badges: number;
  streak: number;
  lastActivity: Date;
  isActive: boolean;
  specialTitles: string[];
  rankChange?: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  title?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
  type?: 'global' | 'school' | 'course' | 'category';
  loading?: boolean;
  showUserPosition?: boolean;
  maxEntries?: number;
  onUserClick?: (userId: string) => void;
  className?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  entries,
  currentUserId,
  title = 'Leaderboard',
  period = 'monthly',
  type = 'school',
  loading = false,
  showUserPosition = true,
  maxEntries = 10,
  onUserClick,
  className = '',
}) => {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const displayEntries = entries.slice(0, maxEntries);
  const currentUserEntry = currentUserId ? entries.find(e => e.userId === currentUserId) : null;
  const currentUserInTop = currentUserEntry && currentUserEntry.rank <= maxEntries;

  const periodLabels = {
    daily: 'Today',
    weekly: 'This Week',
    monthly: 'This Month',
    yearly: 'This Year',
    all_time: 'All Time',
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  const getRankChangeIcon = (change?: number) => {
    if (!change || change === 0) return '—';
    if (change > 0) return '📈';
    return '📉';
  };

  const getRankChangeColor = (change?: number) => {
    if (!change || change === 0) return 'text-gray-500';
    if (change > 0) return 'text-green-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md ${className}`}>
        <div className="p-4 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              </div>
              <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            <p className="text-blue-100 text-sm">{periodLabels[period]}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl">🏆</div>
          </div>
        </div>
      </div>

      {/* Leaderboard Entries */}
      <div className="divide-y divide-gray-100">
        {displayEntries.map((entry, index) => {
          const isCurrentUser = entry.userId === currentUserId;
          const isExpanded = expandedUser === entry.userId;
          const rankIcon = getRankIcon(entry.rank);

          return (
            <div
              key={entry.userId}
              className={`
                p-4 transition-all duration-200
                ${isCurrentUser ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}
                ${onUserClick ? 'cursor-pointer' : ''}
              `}
              onClick={() => {
                if (onUserClick) onUserClick(entry.userId);
                setExpandedUser(isExpanded ? null : entry.userId);
              }}
              role={onUserClick ? 'button' : undefined}
              tabIndex={onUserClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (onUserClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onUserClick(entry.userId);
                  setExpandedUser(isExpanded ? null : entry.userId);
                }
              }}
              aria-label={`${entry.userName} - Rank ${entry.rank} with ${entry.points} points`}
            >
              <div className="flex items-center space-x-3">
                {/* Rank */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {rankIcon ? (
                    <span className="text-xl" aria-label={`Rank ${entry.rank}`}>
                      {rankIcon}
                    </span>
                  ) : (
                    <span className="text-lg font-bold text-gray-600">
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* User Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 relative">
                    {entry.userAvatar ? (
                      <Image
                        src={entry.userAvatar}
                        alt={entry.userName}
                        width={48}
                        height={48}
                        className="w-full h-full rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {entry.userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    
                    {/* Level Badge */}
                    <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                      {entry.level}
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {entry.userName}
                      {isCurrentUser && (
                        <span className="ml-2 text-blue-600 text-xs">(You)</span>
                      )}
                    </p>
                    
                    {/* Activity Status */}
                    <div
                      className={`
                        w-2 h-2 rounded-full
                        ${entry.isActive ? 'bg-green-400' : 'bg-gray-300'}
                      `}
                      title={entry.isActive ? 'Active' : 'Inactive'}
                    />
                  </div>

                  {/* Special Titles */}
                  {entry.specialTitles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entry.specialTitles.slice(0, 2).map((title, i) => (
                        <span
                          key={i}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full"
                        >
                          {title}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Quick Stats */}
                  <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                    <span>🎯 {entry.points.toLocaleString()}</span>
                    <span>🎖️ {entry.badges}</span>
                    {entry.streak > 0 && (
                      <span>🔥 {entry.streak}</span>
                    )}
                  </div>
                </div>

                {/* Rank Change & Points */}
                <div className="flex-shrink-0 text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {entry.points.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">points</div>
                  
                  {/* Rank Change */}
                  {entry.rankChange !== undefined && (
                    <div className={`text-xs ${getRankChangeColor(entry.rankChange)} mt-1`}>
                      {getRankChangeIcon(entry.rankChange)}
                      {entry.rankChange !== 0 && Math.abs(entry.rankChange)}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Level</div>
                      <div className="font-semibold">{entry.level}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Badges</div>
                      <div className="font-semibold">{entry.badges}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Streak</div>
                      <div className="font-semibold">{entry.streak} days</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Last Active</div>
                      <div className="font-semibold">
                        {new Date(entry.lastActivity).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current User Position (if not in top) */}
      {showUserPosition && currentUserEntry && !currentUserInTop && (
        <div className="border-t-2 border-blue-200 bg-blue-50 p-4">
          <div className="text-center text-sm text-blue-600 mb-2">Your Position</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-blue-700">#{currentUserEntry.rank}</span>
              <span className="font-medium">{currentUserEntry.userName}</span>
            </div>
            <div className="text-blue-700 font-bold">
              {currentUserEntry.points.toLocaleString()} pts
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {entries.length === 0 && !loading && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-4xl mb-4">🏆</div>
          <p>No rankings available yet.</p>
          <p className="text-sm mt-2">Start earning points to appear on the leaderboard!</p>
        </div>
      )}
    </div>
  );
};

export default Leaderboard; 