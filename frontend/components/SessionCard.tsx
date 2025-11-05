import React, { useState } from 'react';
import { AnalysisResult, MetricReport } from '../types/bachata-analysis';

interface SessionCardProps {
  result: AnalysisResult;
  overallScore: number;
  className?: string;
}

interface DrillTimerProps {
  drill: { title: string; durationSec: number; how: string };
  onComplete: () => void;
}

const DrillTimer: React.FC<DrillTimerProps> = ({ drill, onComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(drill.durationSec);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    if (intervalId) return;

    setIsRunning(true);
    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setIntervalId(null);
          onComplete();
          return drill.durationSec;
        }
        return prev - 1;
      });
    }, 1000);
    setIntervalId(id);
  };

  const stopTimer = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsRunning(false);
    setTimeLeft(drill.durationSec);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h4 className="font-semibold text-lg mb-2">{drill.title}</h4>
      <p className="text-sm text-gray-600 mb-4">{drill.how}</p>
      
      <div className="flex items-center justify-between">
        <div className="text-2xl font-mono font-bold">
          {formatTime(timeLeft)}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={startTimer}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-medium ${
              isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isRunning ? 'Running...' : 'Start'}
          </button>
          
          <button
            onClick={stopTimer}
            disabled={!isRunning}
            className={`px-4 py-2 rounded-lg font-medium ${
              !isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};

const ScoreCircle: React.FC<{ score: number; label: string; color?: string }> = ({
  score,
  label,
  color = '#3b82f6'
}) => {
  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="#e5e7eb"
            strokeWidth="6"
            fill="none"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold">{Math.round(score)}</span>
        </div>
      </div>
      <span className="text-sm text-gray-600 mt-2 text-center">{label}</span>
    </div>
  );
};

export const SessionCard: React.FC<SessionCardProps> = ({
  result,
  overallScore,
  className = '',
}) => {
  const [activeDrill, setActiveDrill] = useState<number | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getMetricScore = (metric: keyof MetricReport, value: MetricReport[keyof MetricReport]) => {
    switch (metric) {
      case 'timing_ms':
        const timingValue = typeof value === 'object' && 'mean' in value ? Math.abs(value.mean) : Math.abs(value as number);
        return Math.max(0, 100 - timingValue / 2);
      case 'weight_transfer_ratio':
        return (value as number) * 100;
      case 'posture_deg':
        return Math.max(0, 100 - (value as number) * 5);
      case 'hip_amplitude_deg':
        return Math.min(100, ((value as number) / 10) * 100);
      case 'smoothness':
        return (value as number) * 100;
      default:
        return 0;
    }
  };

  const timingScore = getMetricScore('timing_ms', result.metrics.timing_ms);
  const weightTransferScore = getMetricScore('weight_transfer_ratio', result.metrics.weight_transfer_ratio);
  const postureScore = getMetricScore('posture_deg', result.metrics.posture_deg);
  const hipScore = getMetricScore('hip_amplitude_deg', result.metrics.hip_amplitude_deg);
  const smoothnessScore = getMetricScore('smoothness', result.metrics.smoothness);

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      {/* Overall Score */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-4">Session Analysis</h2>
        <ScoreCircle 
          score={overallScore} 
          label="Overall Score"
          color={getScoreColor(overallScore)}
        />
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <ScoreCircle score={timingScore} label="Timing" color={getScoreColor(timingScore)} />
        <ScoreCircle score={weightTransferScore} label="Weight Transfer" color={getScoreColor(weightTransferScore)} />
        <ScoreCircle score={postureScore} label="Posture" color={getScoreColor(postureScore)} />
        <ScoreCircle score={hipScore} label="Hip Movement" color={getScoreColor(hipScore)} />
        <ScoreCircle score={smoothnessScore} label="Smoothness" color={getScoreColor(smoothnessScore)} />
      </div>

      {/* Feedback */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Feedback</h3>
        <div className="space-y-2">
          {result.feedback.map((feedback, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
              <p className="text-gray-700">{feedback}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Drills */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recommended Drills</h3>
        <div className="space-y-4">
          {result.drills.map((drill, index) => (
            <div key={index}>
              {activeDrill === index ? (
                <DrillTimer
                  drill={drill}
                  onComplete={() => {
                    setActiveDrill(null);
                    alert(`Great job completing "${drill.title}"!`);
                  }}
                />
              ) : (
                <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{drill.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{drill.how}</p>
                      <span className="text-xs text-blue-600">
                        Duration: {Math.floor(drill.durationSec / 60)}:{String(drill.durationSec % 60).padStart(2, '0')}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveDrill(index)}
                      className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Start Drill
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
