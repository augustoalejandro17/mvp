import { Injectable } from '@nestjs/common';

// Define types locally for the analysis engine
interface Frame {
  t: number;
  keypoints: Array<{ name: string; x: number; y: number; v?: number }>;
}

interface MetricReport {
  timing_ms: { mean: number; std: number };
  weight_transfer_ratio: number;
  posture_deg: number;
  hip_amplitude_deg: number;
  smoothness: number;
}

interface TimelineEvent {
  t: number;
  type: string;
  value?: number;
  note?: string;
}

interface Drill {
  title: string;
  durationSec: number;
  how: string;
}

interface TimingResult {
  mean: number;
  std: number;
  events: TimelineEvent[];
}

interface WeightTransferResult {
  ratio: number;
  events: TimelineEvent[];
}

interface PostureResult {
  posture_deg: number;
  events: TimelineEvent[];
}

interface HipAmplitudeResult {
  hip_amplitude_deg: number;
  events: TimelineEvent[];
}

interface SmoothnessResult {
  smoothness: number;
  events: TimelineEvent[];
}

@Injectable()
export class AnalysisEngineService {
  // Thresholds for feedback
  private readonly TIMING_THRESHOLDS = {
    GOOD: 80,
    NEEDS_WORK: 150,
  };

  private readonly WEIGHT_TRANSFER_THRESHOLDS = {
    GOOD: 0.8,
    NEEDS_WORK: 0.6,
  };

  private readonly POSTURE_THRESHOLDS = {
    GOOD: 5,
    NEEDS_WORK: 10,
  };

  private readonly HIP_THRESHOLDS = {
    GOOD: 6,
    NEEDS_WORK: 3,
  };

  private readonly SMOOTHNESS_THRESHOLDS = {
    GOOD: 0.7,
    NEEDS_WORK: 0.5,
  };

  computeTiming(frames: Frame[], bpm?: number): TimingResult {
    const events: TimelineEvent[] = [];
    
    if (!bpm || frames.length < 2) {
      return { mean: 0, std: 0, events };
    }

    // Beat interval in ms
    const beatIntervalMs = (60 / bpm) * 1000;
    
    // Find step hits by detecting peaks in ankle vertical velocity
    const stepHits = this.detectStepHits(frames);
    
    // Compare to beat grid
    const offsets: number[] = [];
    
    for (const stepTime of stepHits) {
      // Find closest beat
      const beatNumber = Math.round(stepTime / beatIntervalMs);
      const expectedBeatTime = beatNumber * beatIntervalMs;
      const offset = stepTime - expectedBeatTime;
      
      offsets.push(offset);
      
      // Add timeline events for significant timing issues
      if (Math.abs(offset) > this.TIMING_THRESHOLDS.GOOD) {
        events.push({
          t: stepTime,
          type: offset > 0 ? 'late' : 'early',
          value: Math.abs(offset),
          note: `${Math.abs(offset).toFixed(0)}ms ${offset > 0 ? 'late' : 'early'}`,
        });
      }
    }

    const mean = offsets.length > 0 ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 0;
    const variance = offsets.length > 0 ? 
      offsets.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / offsets.length : 0;
    const std = Math.sqrt(variance);

    return { mean, std, events };
  }

  computeWeightTransfer(frames: Frame[]): WeightTransferResult {
    const events: TimelineEvent[] = [];
    
    if (frames.length < 3) {
      return { ratio: 0, events };
    }

    let clearTransfers = 0;
    let totalBeats = 0;

    // Analyze pelvis lateral movement and foot support
    for (let i = 1; i < frames.length - 1; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];
      const nextFrame = frames[i + 1];

      const pelvisShift = this.calculatePelvisShift(prevFrame, currFrame, nextFrame);
      const supportChange = this.detectSupportChange(prevFrame, currFrame, nextFrame);

      totalBeats++;

      if (supportChange && pelvisShift > 0.02) { // threshold for clear transfer
        clearTransfers++;
      } else if (!supportChange) {
        events.push({
          t: currFrame.t,
          type: 'double_support',
          note: 'Weight not clearly transferred',
        });
      }
    }

    const ratio = totalBeats > 0 ? clearTransfers / totalBeats : 0;
    return { ratio, events };
  }

  computePosture(frames: Frame[]): PostureResult {
    const events: TimelineEvent[] = [];
    
    if (frames.length === 0) {
      return { posture_deg: 0, events };
    }

    const leanAngles: number[] = [];

    for (const frame of frames) {
      const leanAngle = this.calculateTorsoLean(frame);
      leanAngles.push(Math.abs(leanAngle));

      // Add events for significant posture issues
      if (Math.abs(leanAngle) > this.POSTURE_THRESHOLDS.NEEDS_WORK) {
        events.push({
          t: frame.t,
          type: 'posture_warn',
          value: Math.abs(leanAngle),
          note: `${Math.abs(leanAngle).toFixed(1)}° lean`,
        });
      }
    }

    const posture_deg = leanAngles.reduce((a, b) => a + b, 0) / leanAngles.length;
    return { posture_deg, events };
  }

  computeHipAmplitude(frames: Frame[]): HipAmplitudeResult {
    const events: TimelineEvent[] = [];
    
    if (frames.length < 2) {
      return { hip_amplitude_deg: 0, events };
    }

    const hipAmplitudes: number[] = [];

    for (let i = 1; i < frames.length; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];
      
      const hipMovement = this.calculateHipIsolation(prevFrame, currFrame);
      hipAmplitudes.push(hipMovement);

      // Add events for low hip movement
      if (hipMovement < this.HIP_THRESHOLDS.NEEDS_WORK) {
        events.push({
          t: currFrame.t,
          type: 'hip_low',
          value: hipMovement,
          note: 'Low hip isolation',
        });
      }
    }

    const hip_amplitude_deg = hipAmplitudes.reduce((a, b) => a + b, 0) / hipAmplitudes.length;
    return { hip_amplitude_deg, events };
  }

  computeSmoothness(frames: Frame[]): SmoothnessResult {
    const events: TimelineEvent[] = [];
    
    if (frames.length < 4) {
      return { smoothness: 1, events };
    }

    // Calculate jerk (3rd derivative) for key joints
    const joints = ['left_wrist', 'right_wrist', 'left_elbow', 'right_elbow'];
    let totalJerk = 0;
    let jointCount = 0;

    for (const jointName of joints) {
      const jerk = this.calculateJerk(frames, jointName);
      if (jerk !== null) {
        totalJerk += jerk;
        jointCount++;
      }
    }

    const avgJerk = jointCount > 0 ? totalJerk / jointCount : 0;
    const smoothness = Math.max(0, 1 - (avgJerk / 100)); // normalize to 0-1

    // Add events for rigid movement
    if (smoothness < this.SMOOTHNESS_THRESHOLDS.NEEDS_WORK) {
      const midFrame = frames[Math.floor(frames.length / 2)];
      events.push({
        t: midFrame.t,
        type: 'arm_rigid',
        value: smoothness,
        note: 'Rigid arm movement detected',
      });
    }

    return { smoothness, events };
  }

  buildFeedback(metrics: MetricReport): { feedback: string[]; drills: Drill[] } {
    const feedback: string[] = [];
    const drills: Drill[] = [];

    // Timing feedback
    const timingMean = Math.abs(metrics.timing_ms.mean);
    if (timingMean <= this.TIMING_THRESHOLDS.GOOD) {
      feedback.push('Great timing! You\'re staying well synchronized with the music.');
    } else if (timingMean <= this.TIMING_THRESHOLDS.NEEDS_WORK) {
      feedback.push('Your timing needs some work. Try to feel the beat more clearly.');
      drills.push({
        title: 'Metronome Practice',
        durationSec: 60,
        how: 'Practice basic steps with a metronome at 100 BPM. Count 1-2-3-tap and focus on hitting each beat precisely.',
      });
    } else {
      feedback.push('You\'re significantly off-beat. Focus on listening to the music and feeling the rhythm.');
      drills.push({
        title: 'Metronome Practice',
        durationSec: 60,
        how: 'Practice basic steps with a metronome at 100 BPM. Count 1-2-3-tap and focus on hitting each beat precisely.',
      });
    }

    // Weight transfer feedback
    if (metrics.weight_transfer_ratio >= this.WEIGHT_TRANSFER_THRESHOLDS.GOOD) {
      feedback.push('Excellent weight transfer! You\'re clearly shifting your weight with each step.');
    } else if (metrics.weight_transfer_ratio >= this.WEIGHT_TRANSFER_THRESHOLDS.NEEDS_WORK) {
      feedback.push('Your weight transfer could be clearer. Make sure to fully commit to each step.');
      drills.push({
        title: 'Side Step with Pause',
        durationSec: 60,
        how: 'Step side to side, pausing on beats 2 and 4. Feel your full weight on each foot before transferring.',
      });
    } else {
      feedback.push('Work on your weight transfer. You\'re not clearly shifting weight between feet.');
      drills.push({
        title: 'Side Step with Pause',
        durationSec: 60,
        how: 'Step side to side, pausing on beats 2 and 4. Feel your full weight on each foot before transferring.',
      });
    }

    // Posture feedback
    if (metrics.posture_deg <= this.POSTURE_THRESHOLDS.GOOD) {
      feedback.push('Great posture! You\'re maintaining good alignment.');
    } else if (metrics.posture_deg <= this.POSTURE_THRESHOLDS.NEEDS_WORK) {
      feedback.push('Watch your posture - you\'re leaning slightly. Keep your chest up and spine straight.');
      drills.push({
        title: 'Wall Touch Posture',
        durationSec: 45,
        how: 'Stand with your back against a wall. Practice basic steps while keeping your shoulders and head touching the wall.',
      });
    } else {
      feedback.push('Focus on your posture. You\'re leaning too much - keep your torso upright.');
      drills.push({
        title: 'Wall Touch Posture',
        durationSec: 45,
        how: 'Stand with your back against a wall. Practice basic steps while keeping your shoulders and head touching the wall.',
      });
    }

    // Hip amplitude feedback
    if (metrics.hip_amplitude_deg >= this.HIP_THRESHOLDS.GOOD) {
      feedback.push('Nice hip movement! You\'re isolating your hips well.');
    } else if (metrics.hip_amplitude_deg >= this.HIP_THRESHOLDS.NEEDS_WORK) {
      feedback.push('Try to move your hips more. Bachata is about hip isolation and movement.');
      drills.push({
        title: 'Hip Figure-Eight',
        durationSec: 60,
        how: 'Stand in front of a mirror and practice figure-eight hip movements. Focus on isolating hips from torso.',
      });
    } else {
      feedback.push('You need more hip movement. Bachata is all about the hips!');
      drills.push({
        title: 'Hip Figure-Eight',
        durationSec: 60,
        how: 'Stand in front of a mirror and practice figure-eight hip movements. Focus on isolating hips from torso.',
      });
    }

    // Smoothness feedback
    if (metrics.smoothness >= this.SMOOTHNESS_THRESHOLDS.GOOD) {
      feedback.push('Your movement is smooth and flowing - great job!');
    } else if (metrics.smoothness >= this.SMOOTHNESS_THRESHOLDS.NEEDS_WORK) {
      feedback.push('Try to make your movements more fluid and less rigid.');
      drills.push({
        title: 'Floating Arms',
        durationSec: 45,
        how: 'Keep your arms 10-15cm away from your torso and let them flow naturally with your body movement.',
      });
    } else {
      feedback.push('Your movements are too rigid. Focus on flowing and connecting your whole body.');
      drills.push({
        title: 'Floating Arms',
        durationSec: 45,
        how: 'Keep your arms 10-15cm away from your torso and let them flow naturally with your body movement.',
      });
    }

    return { feedback, drills };
  }

  computeOverallScore(metrics: MetricReport): number {
    // Weighted scoring (0-100)
    const timingScore = Math.max(0, 100 - Math.abs(metrics.timing_ms.mean) / 2);
    const weightTransferScore = metrics.weight_transfer_ratio * 100;
    const postureScore = Math.max(0, 100 - (metrics.posture_deg * 5));
    const hipScore = Math.min(100, (metrics.hip_amplitude_deg / 10) * 100);
    const smoothnessScore = metrics.smoothness * 100;

    // Weighted average
    const overallScore = (
      timingScore * 0.3 +
      weightTransferScore * 0.25 +
      postureScore * 0.2 +
      hipScore * 0.15 +
      smoothnessScore * 0.1
    );

    return Math.round(Math.max(0, Math.min(100, overallScore)));
  }

  // Helper methods
  private detectStepHits(frames: Frame[]): number[] {
    const stepHits: number[] = [];
    
    if (frames.length < 3) return stepHits;

    // Look for vertical velocity peaks in ankles
    for (let i = 1; i < frames.length - 1; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];
      const nextFrame = frames[i + 1];

      const leftAnklePrev = this.findKeypoint(prevFrame, 'left_ankle');
      const leftAnkleCurr = this.findKeypoint(currFrame, 'left_ankle');
      const leftAnkleNext = this.findKeypoint(nextFrame, 'left_ankle');

      const rightAnklePrev = this.findKeypoint(prevFrame, 'right_ankle');
      const rightAnkleCurr = this.findKeypoint(currFrame, 'right_ankle');
      const rightAnkleNext = this.findKeypoint(nextFrame, 'right_ankle');

      if (leftAnklePrev && leftAnkleCurr && leftAnkleNext) {
        const leftVelPrev = leftAnkleCurr.y - leftAnklePrev.y;
        const leftVelCurr = leftAnkleNext.y - leftAnkleCurr.y;
        
        // Peak detection (velocity changes from positive to negative)
        if (leftVelPrev > 0.001 && leftVelCurr < -0.001) {
          stepHits.push(currFrame.t);
        }
      }

      if (rightAnklePrev && rightAnkleCurr && rightAnkleNext) {
        const rightVelPrev = rightAnkleCurr.y - rightAnklePrev.y;
        const rightVelCurr = rightAnkleNext.y - rightAnkleCurr.y;
        
        if (rightVelPrev > 0.001 && rightVelCurr < -0.001) {
          stepHits.push(currFrame.t);
        }
      }
    }

    return stepHits.sort((a, b) => a - b);
  }

  private calculatePelvisShift(prevFrame: Frame, currFrame: Frame, nextFrame: Frame): number {
    const prevHip = this.getMidpoint(
      this.findKeypoint(prevFrame, 'left_hip'),
      this.findKeypoint(prevFrame, 'right_hip')
    );
    const currHip = this.getMidpoint(
      this.findKeypoint(currFrame, 'left_hip'),
      this.findKeypoint(currFrame, 'right_hip')
    );

    if (!prevHip || !currHip) return 0;

    return Math.abs(currHip.x - prevHip.x);
  }

  private detectSupportChange(prevFrame: Frame, currFrame: Frame, nextFrame: Frame): boolean {
    // Simplified: check if there's significant lateral movement
    const prevHip = this.getMidpoint(
      this.findKeypoint(prevFrame, 'left_hip'),
      this.findKeypoint(prevFrame, 'right_hip')
    );
    const currHip = this.getMidpoint(
      this.findKeypoint(currFrame, 'left_hip'),
      this.findKeypoint(currFrame, 'right_hip')
    );

    if (!prevHip || !currHip) return false;

    return Math.abs(currHip.x - prevHip.x) > 0.01;
  }

  private calculateTorsoLean(frame: Frame): number {
    const leftShoulder = this.findKeypoint(frame, 'left_shoulder');
    const rightShoulder = this.findKeypoint(frame, 'right_shoulder');
    const leftHip = this.findKeypoint(frame, 'left_hip');
    const rightHip = this.findKeypoint(frame, 'right_hip');

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return 0;

    const shoulderMid = this.getMidpoint(leftShoulder, rightShoulder);
    const hipMid = this.getMidpoint(leftHip, rightHip);

    if (!shoulderMid || !hipMid) return 0;

    // Calculate angle from vertical
    const deltaX = shoulderMid.x - hipMid.x;
    const deltaY = shoulderMid.y - hipMid.y;
    
    const angleRad = Math.atan2(deltaX, deltaY);
    return (angleRad * 180) / Math.PI;
  }

  private calculateHipIsolation(prevFrame: Frame, currFrame: Frame): number {
    const prevHip = this.getMidpoint(
      this.findKeypoint(prevFrame, 'left_hip'),
      this.findKeypoint(prevFrame, 'right_hip')
    );
    const currHip = this.getMidpoint(
      this.findKeypoint(currFrame, 'left_hip'),
      this.findKeypoint(currFrame, 'right_hip')
    );

    const prevShoulder = this.getMidpoint(
      this.findKeypoint(prevFrame, 'left_shoulder'),
      this.findKeypoint(prevFrame, 'right_shoulder')
    );
    const currShoulder = this.getMidpoint(
      this.findKeypoint(currFrame, 'left_shoulder'),
      this.findKeypoint(currFrame, 'right_shoulder')
    );

    if (!prevHip || !currHip || !prevShoulder || !currShoulder) return 0;

    const hipMovement = Math.abs(currHip.x - prevHip.x);
    const shoulderMovement = Math.abs(currShoulder.x - prevShoulder.x);

    // Hip isolation ratio (hip movement relative to shoulder movement)
    const isolation = shoulderMovement > 0 ? hipMovement / shoulderMovement : hipMovement;
    return isolation * 100; // convert to degrees equivalent
  }

  private calculateJerk(frames: Frame[], jointName: string): number | null {
    if (frames.length < 4) return null;

    const positions: { x: number; y: number; t: number }[] = [];
    
    for (const frame of frames) {
      const joint = this.findKeypoint(frame, jointName);
      if (joint) {
        positions.push({ x: joint.x, y: joint.y, t: frame.t });
      }
    }

    if (positions.length < 4) return null;

    // Calculate jerk (3rd derivative)
    let totalJerk = 0;
    for (let i = 3; i < positions.length; i++) {
      const p1 = positions[i - 3];
      const p2 = positions[i - 2];
      const p3 = positions[i - 1];
      const p4 = positions[i];

      const dt = (p4.t - p1.t) / 3; // average time step
      if (dt <= 0) continue;

      // Approximate 3rd derivative
      const jerkX = (p4.x - 3 * p3.x + 3 * p2.x - p1.x) / (dt * dt * dt);
      const jerkY = (p4.y - 3 * p3.y + 3 * p2.y - p1.y) / (dt * dt * dt);
      
      totalJerk += Math.sqrt(jerkX * jerkX + jerkY * jerkY);
    }

    return totalJerk / (positions.length - 3);
  }

  private findKeypoint(frame: Frame, name: string) {
    return frame.keypoints.find(kp => kp.name === name);
  }

  private getMidpoint(p1: any, p2: any) {
    if (!p1 || !p2) return null;
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }
}
