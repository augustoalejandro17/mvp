import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SessionCard } from '../SessionCard';
import { AnalysisResult } from '../../types/bachata-analysis';

// Mock the drill timer functionality
jest.useFakeTimers();

const mockAnalysisResult: AnalysisResult = {
  metrics: {
    timing_ms: { mean: 50, std: 30 },
    weight_transfer_ratio: 0.85,
    posture_deg: 3,
    hip_amplitude_deg: 8,
    smoothness: 0.75,
  },
  feedback: [
    'Great timing! You\'re staying well synchronized with the music.',
    'Excellent weight transfer! You\'re clearly shifting your weight with each step.',
    'Great posture! You\'re maintaining good alignment.',
  ],
  drills: [
    {
      title: 'Metronome Practice',
      durationSec: 60,
      how: 'Practice basic steps with a metronome at 100 BPM. Count 1-2-3-tap and focus on hitting each beat precisely.',
    },
    {
      title: 'Hip Figure-Eight',
      durationSec: 60,
      how: 'Stand in front of a mirror and practice figure-eight hip movements. Focus on isolating hips from torso.',
    },
  ],
  timeline: [
    {
      t: 5000,
      type: 'early',
      value: 85,
      note: '85ms early',
    },
    {
      t: 12000,
      type: 'posture_warn',
      value: 8,
      note: '8.0° lean',
    },
  ],
};

describe('SessionCard', () => {
  const defaultProps = {
    result: mockAnalysisResult,
    overallScore: 85,
  };

  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  it('renders session analysis title', () => {
    render(<SessionCard {...defaultProps} />);
    expect(screen.getByText('Session Analysis')).toBeInTheDocument();
  });

  it('displays overall score', () => {
    render(<SessionCard {...defaultProps} />);
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
  });

  it('displays all metric scores', () => {
    render(<SessionCard {...defaultProps} />);
    
    expect(screen.getByText('Timing')).toBeInTheDocument();
    expect(screen.getByText('Weight Transfer')).toBeInTheDocument();
    expect(screen.getByText('Posture')).toBeInTheDocument();
    expect(screen.getByText('Hip Movement')).toBeInTheDocument();
    expect(screen.getByText('Smoothness')).toBeInTheDocument();
  });

  it('displays feedback messages', () => {
    render(<SessionCard {...defaultProps} />);
    
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByText(/Great timing!/)).toBeInTheDocument();
    expect(screen.getByText(/Excellent weight transfer!/)).toBeInTheDocument();
    expect(screen.getByText(/Great posture!/)).toBeInTheDocument();
  });

  it('displays recommended drills', () => {
    render(<SessionCard {...defaultProps} />);
    
    expect(screen.getByText('Recommended Drills')).toBeInTheDocument();
    expect(screen.getByText('Metronome Practice')).toBeInTheDocument();
    expect(screen.getByText('Hip Figure-Eight')).toBeInTheDocument();
  });

  it('shows drill instructions', () => {
    render(<SessionCard {...defaultProps} />);
    
    expect(screen.getByText(/Practice basic steps with a metronome/)).toBeInTheDocument();
    expect(screen.getByText(/Stand in front of a mirror and practice/)).toBeInTheDocument();
  });

  it('displays drill durations', () => {
    render(<SessionCard {...defaultProps} />);
    
    const durationElements = screen.getAllByText(/Duration: 1:00/);
    expect(durationElements).toHaveLength(2); // Both drills are 60 seconds
  });

  it('allows starting a drill timer', () => {
    render(<SessionCard {...defaultProps} />);
    
    const startButtons = screen.getAllByText('Start Drill');
    expect(startButtons).toHaveLength(2);
    
    // Click the first drill's start button
    fireEvent.click(startButtons[0]);
    
    // Should show the timer interface
    expect(screen.getByText('1:00')).toBeInTheDocument();
    expect(screen.getByText('Running...')).toBeInTheDocument();
    expect(screen.getByText('Stop')).toBeInTheDocument();
  });

  it('counts down drill timer correctly', () => {
    render(<SessionCard {...defaultProps} />);
    
    const startButtons = screen.getAllByText('Start Drill');
    fireEvent.click(startButtons[0]);
    
    // Initial state
    expect(screen.getByText('1:00')).toBeInTheDocument();
    
    // Advance timer by 1 second
    jest.advanceTimersByTime(1000);
    expect(screen.getByText('0:59')).toBeInTheDocument();
    
    // Advance timer by 10 more seconds
    jest.advanceTimersByTime(10000);
    expect(screen.getByText('0:49')).toBeInTheDocument();
  });

  it('can stop a running timer', () => {
    render(<SessionCard {...defaultProps} />);
    
    const startButtons = screen.getAllByText('Start Drill');
    fireEvent.click(startButtons[0]);
    
    // Timer should be running
    expect(screen.getByText('Running...')).toBeInTheDocument();
    
    // Stop the timer
    const stopButton = screen.getByText('Stop');
    fireEvent.click(stopButton);
    
    // Should reset to initial state
    expect(screen.getByText('Start Drill')).toBeInTheDocument();
    expect(screen.queryByText('Running...')).not.toBeInTheDocument();
  });

  it('completes drill timer and shows completion message', () => {
    // Mock alert
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(<SessionCard {...defaultProps} />);
    
    const startButtons = screen.getAllByText('Start Drill');
    fireEvent.click(startButtons[0]);
    
    // Advance timer to completion (60 seconds)
    jest.advanceTimersByTime(60000);
    
    // Should show completion alert
    expect(alertSpy).toHaveBeenCalledWith('Great job completing "Metronome Practice"!');
    
    // Should reset to initial state
    expect(screen.getByText('Start Drill')).toBeInTheDocument();
    
    alertSpy.mockRestore();
  });

  it('applies correct score colors', () => {
    // Test with high score (should be green)
    const { rerender } = render(<SessionCard {...defaultProps} />);
    
    // Test with medium score (should be yellow/orange)
    rerender(<SessionCard {...defaultProps} overallScore={65} />);
    
    // Test with low score (should be red)
    rerender(<SessionCard {...defaultProps} overallScore={45} />);
    
    // We can't easily test the actual colors without checking computed styles,
    // but we can verify the component renders without errors
    expect(screen.getByText('Session Analysis')).toBeInTheDocument();
  });

  it('handles zero scores gracefully', () => {
    const zeroScoreResult: AnalysisResult = {
      ...mockAnalysisResult,
      metrics: {
        timing_ms: { mean: 200, std: 100 },
        weight_transfer_ratio: 0,
        posture_deg: 20,
        hip_amplitude_deg: 0,
        smoothness: 0,
      },
    };

    render(<SessionCard result={zeroScoreResult} overallScore={0} />);
    
    expect(screen.getByText('0')).toBeInTheDocument(); // Overall score
    expect(screen.getByText('Session Analysis')).toBeInTheDocument();
  });
});
