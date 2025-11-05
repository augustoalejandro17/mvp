import React from 'react';
import { TimelineEvent } from '../types/bachata-analysis';

interface TimelineProps {
  events: TimelineEvent[];
  durationMs: number;
  currentTime?: number;
  bpm?: number;
  onSeek?: (timeMs: number) => void;
  className?: string;
}

const EVENT_COLORS = {
  early: '#ff6b6b',
  late: '#ffa726',
  double_support: '#42a5f5',
  posture_warn: '#ab47bc',
  hip_low: '#26c6da',
  arm_rigid: '#66bb6a',
};

const EVENT_LABELS = {
  early: 'Early',
  late: 'Late',
  double_support: 'Double Support',
  posture_warn: 'Posture',
  hip_low: 'Hip Movement',
  arm_rigid: 'Arm Stiffness',
};

export const Timeline: React.FC<TimelineProps> = ({
  events,
  durationMs,
  currentTime = 0,
  bpm,
  onSeek,
  className = '',
}) => {
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const timeMs = percentage * durationMs;
    
    onSeek(timeMs);
  };

  const renderBeatMarkers = () => {
    if (!bpm) return null;

    const beatIntervalMs = (60 / bpm) * 1000;
    const beatCount = Math.floor(durationMs / beatIntervalMs);
    const markers = [];

    for (let i = 0; i <= beatCount; i++) {
      const beatTime = i * beatIntervalMs;
      const position = (beatTime / durationMs) * 100;

      markers.push(
        <div
          key={i}
          className="absolute top-0 bottom-0 w-px bg-gray-300 opacity-50"
          style={{ left: `${position}%` }}
        />
      );
    }

    return markers;
  };

  const renderEvents = () => {
    return events.map((event, index) => {
      const position = (event.t / durationMs) * 100;
      const color = EVENT_COLORS[event.type] || '#666';

      return (
        <div
          key={index}
          className="absolute top-1 bottom-1 w-1 rounded-sm cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            left: `${position}%`,
            backgroundColor: color,
          }}
          title={`${EVENT_LABELS[event.type]}: ${event.note || ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onSeek?.(event.t);
          }}
        />
      );
    });
  };

  const currentPosition = (currentTime / durationMs) * 100;

  return (
    <div className={`w-full ${className}`}>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        {Object.entries(EVENT_LABELS).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: EVENT_COLORS[type as keyof typeof EVENT_COLORS] }}
            />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div
        className="relative h-8 bg-gray-100 rounded-lg cursor-pointer overflow-hidden"
        onClick={handleTimelineClick}
      >
        {/* Beat markers */}
        {renderBeatMarkers()}

        {/* Events */}
        {renderEvents()}

        {/* Current time indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
          style={{ left: `${currentPosition}%` }}
        >
          <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" />
        </div>

        {/* Time labels */}
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-gray-500 pointer-events-none">
          <span>0:00</span>
          <span>{Math.floor(durationMs / 60000)}:{String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Current time display */}
      <div className="mt-2 text-center text-sm text-gray-600">
        {Math.floor(currentTime / 60000)}:{String(Math.floor((currentTime % 60000) / 1000)).padStart(2, '0')} / {Math.floor(durationMs / 60000)}:{String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')}
        {bpm && <span className="ml-4">♩ = {bpm} BPM</span>}
      </div>
    </div>
  );
};
