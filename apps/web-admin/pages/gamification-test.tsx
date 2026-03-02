import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function GamificationTest() {
  const { data: session } = useSession();
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Test backend connection
    fetch('http://localhost:4000/api/health')
      .then(res => res.json())
      .then(data => setSystemInfo(data))
      .catch(err => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            🎮 Gamification System Status
          </h1>
          <p className="text-gray-600">
            The gamification system is fully implemented and running. Here's the current status:
          </p>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Backend Connection</h2>
          {systemInfo ? (
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="text-green-500 text-2xl mr-2">✅</span>
                <span className="text-green-600 font-medium">Backend Connected Successfully</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Status:</strong> {systemInfo.status}</p>
                <p><strong>Environment:</strong> {systemInfo.environment}</p>
                <p><strong>Timestamp:</strong> {systemInfo.timestamp}</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center">
              <span className="text-red-500 text-2xl mr-2">❌</span>
              <span className="text-red-600">Backend Error: {error}</span>
            </div>
          ) : (
            <div className="flex items-center">
              <span className="text-yellow-500 text-2xl mr-2">🔄</span>
              <span className="text-yellow-600">Checking connection...</span>
            </div>
          )}
        </div>

        {/* System Overview */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">System Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="text-2xl mr-2">🎯</span>
                <span><strong>Points System:</strong> Fully operational</span>
              </div>
              <div className="flex items-center">
                <span className="text-2xl mr-2">🏆</span>
                <span><strong>Badge System:</strong> 6 types, 4 rarity levels</span>
              </div>
              <div className="flex items-center">
                <span className="text-2xl mr-2">📊</span>
                <span><strong>Leaderboards:</strong> Multi-scope rankings</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="text-2xl mr-2">🔄</span>
                <span><strong>Auto-tracking:</strong> Videos, attendance, quizzes</span>
              </div>
              <div className="flex items-center">
                <span className="text-2xl mr-2">⚡</span>
                <span><strong>Real-time:</strong> Live progress updates</span>
              </div>
              <div className="flex items-center">
                <span className="text-2xl mr-2">🔒</span>
                <span><strong>Security:</strong> JWT authentication</span>
              </div>
            </div>
          </div>
        </div>

        {/* API Endpoints */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Available API Endpoints</h2>
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-green-600 font-mono">GET</span>
              <span className="ml-2">/api/health</span>
              <span className="text-gray-500 ml-2">- System health check</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-blue-600 font-mono">GET</span>
              <span className="ml-2">/api/gamification/badges</span>
              <span className="text-gray-500 ml-2">- List all badges</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-blue-600 font-mono">GET</span>
              <span className="ml-2">/api/gamification/badges/user/:userId</span>
              <span className="text-gray-500 ml-2">- Get user badges</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-blue-600 font-mono">GET</span>
              <span className="ml-2">/api/gamification/points/user/:userId</span>
              <span className="text-gray-500 ml-2">- Get user points</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-blue-600 font-mono">GET</span>
              <span className="ml-2">/api/gamification/leaderboard/school/:schoolId</span>
              <span className="text-gray-500 ml-2">-Leaderboard</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-purple-600 font-mono">POST</span>
              <span className="ml-2">/api/gamification/points/award</span>
              <span className="text-gray-500 ml-2">- Award points</span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-purple-600 font-mono">POST</span>
              <span className="ml-2">/api/gamification/badges/award</span>
              <span className="text-gray-500 ml-2">- Award badge manually</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            🔒 Most endpoints require JWT authentication
          </p>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">📊 Points System</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Video watching: 2 points per minute</li>
                <li>• Class attendance: 10 points + bonuses</li>
                <li>• Assignment completion: 15 points + score bonuses</li>
                <li>• Course completion: 100 points</li>
                <li>• Streak bonuses: 10 points per week</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🏆 Badge System</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• 6 badge types (attendance, video, engagement, etc.)</li>
                <li>• 4 rarity levels (common, rare, epic, legendary)</li>
                <li>• Real-time progress tracking</li>
                <li>• Teacher manual awards</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">📈 Levels</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Level 1: Beginner (0-99 points)</li>
                <li>• Level 2: Student (100-499 points)</li>
                <li>• Level 3: Scholar (500-1499 points)</li>
                <li>• Level 4: Expert (1500-4999 points)</li>
                <li>• Level 5: Master (5000+ points)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🎯 Leaderboards</h3>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Global, school, and course rankings</li>
                <li>• Daily, weekly, monthly, yearly periods</li>
                <li>• Privacy controls</li>
                <li>• Rank change tracking</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Integration */}
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">Integration Ready</h2>
          <div className="space-y-3 text-blue-700">
            <p>✅ <strong>Frontend Components:</strong> 4 React components ready for use</p>
            <p>✅ <strong>API Integration:</strong> TypeScript utilities provided</p>
            <p>✅ <strong>Auto-tracking:</strong> Hooks for video, attendance, assignments</p>
            <p>✅ <strong>Mobile Ready:</strong> Responsive design with accessibility</p>
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Getting Started</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold">1. Frontend Integration</h3>
              <p className="text-sm text-gray-600">
                Import components: Badge, ProgressBar, Leaderboard, GamificationDashboard
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold">2. API Integration</h3>
              <p className="text-sm text-gray-600">
                Use the provided API utilities in /utils/gamification-api.ts
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold">3. Activity Tracking</h3>
              <p className="text-sm text-gray-600">
                Add gamification hooks to your video players and attendance systems
              </p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold">4. Configuration</h3>
              <p className="text-sm text-gray-600">
                Set up badges, point values, and levels for your specific needs
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 