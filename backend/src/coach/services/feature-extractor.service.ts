import { Injectable } from '@nestjs/common';

// Define Frame interface locally
interface Frame {
  t: number;
  keypoints: Array<{ name: string; x: number; y: number; v?: number }>;
}

interface NormalizedKeypoint {
  name: string;
  x: number;
  y: number;
  v?: number;
}

interface NormalizedFrame {
  t: number;
  keypoints: NormalizedKeypoint[];
}

export interface BeatWindow {
  beatIndex: number;
  startTime: number;
  endTime: number;
  frames: NormalizedFrame[];
}

@Injectable()
export class FeatureExtractorService {
  // Fixed feature order for consistency
  private readonly FEATURE_NAMES = [
    'timing_offset_ms',
    'torso_deg', 
    'hip_amp_deg',
    'weight_transfer',
    'arms_smoothness'
  ];

  /**
   * Normalize keypoints to be pelvis-centered and scaled by shoulder width
   */
  normalizeKeypoints(frames: Frame[]): NormalizedFrame[] {
    const normalizedFrames: NormalizedFrame[] = [];

    for (const frame of frames) {
      const leftShoulder = this.findKeypoint(frame, 'left_shoulder');
      const rightShoulder = this.findKeypoint(frame, 'right_shoulder');
      const leftHip = this.findKeypoint(frame, 'left_hip');
      const rightHip = this.findKeypoint(frame, 'right_hip');

      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
        continue; // Skip frames with missing key points
      }

      // Calculate pelvis center
      const pelvisX = (leftHip.x + rightHip.x) / 2;
      const pelvisY = (leftHip.y + rightHip.y) / 2;

      // Calculate shoulder width for scaling
      const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
      const scale = shoulderWidth > 0 ? 1 / shoulderWidth : 1;

      // Normalize all keypoints
      const normalizedKeypoints: NormalizedKeypoint[] = frame.keypoints.map(kp => ({
        name: kp.name,
        x: (kp.x - pelvisX) * scale,
        y: (kp.y - pelvisY) * scale,
        v: kp.v,
      }));

      normalizedFrames.push({
        t: frame.t,
        keypoints: normalizedKeypoints,
      });
    }

    return normalizedFrames;
  }

  /**
   * Generate beat grid based on BPM and duration
   */
  beatGrid(bpm: number, durationMs: number): number[] {
    const beatIntervalMs = (60 / bpm) * 1000;
    const beats: number[] = [];
    
    for (let time = 0; time < durationMs; time += beatIntervalMs) {
      beats.push(time);
    }
    
    return beats;
  }

  /**
   * Group frames into beat windows
   */
  groupFramesByBeats(frames: NormalizedFrame[], beats: number[]): BeatWindow[] {
    const windows: BeatWindow[] = [];

    for (let i = 0; i < beats.length; i++) {
      const startTime = beats[i];
      const endTime = i < beats.length - 1 ? beats[i + 1] : startTime + (60 / 120) * 1000; // Default to 120 BPM interval

      const beatFrames = frames.filter(frame => 
        frame.t >= startTime && frame.t < endTime
      );

      windows.push({
        beatIndex: i,
        startTime,
        endTime,
        frames: beatFrames,
      });
    }

    return windows;
  }

  /**
   * Extract per-beat feature vectors
   */
  extractPerBeatFeatures(frames: Frame[], bpm: number, isReference = false): { featureNames: string[]; perBeat: number[][] } {
    const normalizedFrames = this.normalizeKeypoints(frames);
    const beats = this.beatGrid(bpm, frames[frames.length - 1]?.t || 0);
    const beatWindows = this.groupFramesByBeats(normalizedFrames, beats);

    const perBeat: number[][] = [];

    for (const window of beatWindows) {
      if (window.frames.length === 0) {
        // Fill with zeros if no frames in this beat
        perBeat.push([0, 0, 0, 0, 0]);
        continue;
      }

      const features = [
        this.extractTimingOffset(window, isReference),
        this.extractTorsoDegrees(window),
        this.extractHipAmplitude(window),
        this.extractWeightTransfer(window, beatWindows),
        this.extractArmsSmootness(window),
      ];

      perBeat.push(features);
    }

    return {
      featureNames: this.FEATURE_NAMES,
      perBeat,
    };
  }

  /**
   * Extract timing offset for this beat window
   * For reference, this is always 0. For attempts, calculate offset from expected beat time.
   */
  private extractTimingOffset(window: BeatWindow, isReference: boolean): number {
    if (isReference) {
      return 0; // Reference is always on-time by definition
    }

    // Find step hit by detecting ankle vertical velocity peak
    let stepHitTime: number | null = null;
    const frames = window.frames;

    for (let i = 1; i < frames.length - 1; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];
      const nextFrame = frames[i + 1];

      const leftAnklePrev = this.findKeypoint(prevFrame, 'left_ankle');
      const leftAnkleCurr = this.findKeypoint(currFrame, 'left_ankle');
      const leftAnkleNext = this.findKeypoint(nextFrame, 'left_ankle');

      if (leftAnklePrev && leftAnkleCurr && leftAnkleNext) {
        const velPrev = leftAnkleCurr.y - leftAnklePrev.y;
        const velCurr = leftAnkleNext.y - leftAnkleCurr.y;
        
        // Peak detection (velocity changes from positive to negative)
        if (velPrev > 0.001 && velCurr < -0.001) {
          stepHitTime = currFrame.t;
          break;
        }
      }
    }

    if (stepHitTime === null) {
      return 0; // No clear step detected
    }

    // Calculate offset from expected beat time
    const expectedBeatTime = window.startTime;
    return stepHitTime - expectedBeatTime;
  }

  /**
   * Extract torso lean angle in degrees
   */
  private extractTorsoDegrees(window: BeatWindow): number {
    const angles: number[] = [];

    for (const frame of window.frames) {
      const leftShoulder = this.findKeypoint(frame, 'left_shoulder');
      const rightShoulder = this.findKeypoint(frame, 'right_shoulder');
      const leftHip = this.findKeypoint(frame, 'left_hip');
      const rightHip = this.findKeypoint(frame, 'right_hip');

      if (leftShoulder && rightShoulder && leftHip && rightHip) {
        const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
        const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
        const hipMidX = (leftHip.x + rightHip.x) / 2;
        const hipMidY = (leftHip.y + rightHip.y) / 2;

        // Calculate angle from vertical
        const deltaX = shoulderMidX - hipMidX;
        const deltaY = shoulderMidY - hipMidY;
        
        const angleRad = Math.atan2(deltaX, deltaY);
        const angleDeg = Math.abs((angleRad * 180) / Math.PI);
        
        angles.push(angleDeg);
      }
    }

    return angles.length > 0 ? angles.reduce((a, b) => a + b, 0) / angles.length : 0;
  }

  /**
   * Extract hip amplitude in degrees (frontal plane)
   */
  private extractHipAmplitude(window: BeatWindow): number {
    if (window.frames.length < 2) return 0;

    const hipPositions: number[] = [];

    for (const frame of window.frames) {
      const leftHip = this.findKeypoint(frame, 'left_hip');
      const rightHip = this.findKeypoint(frame, 'right_hip');

      if (leftHip && rightHip) {
        const hipMidX = (leftHip.x + rightHip.x) / 2;
        hipPositions.push(hipMidX);
      }
    }

    if (hipPositions.length < 2) return 0;

    // Calculate range of hip movement
    const minX = Math.min(...hipPositions);
    const maxX = Math.max(...hipPositions);
    const amplitude = maxX - minX;

    // Convert to approximate degrees (rough estimation)
    return amplitude * 100; // Scale factor to convert to degrees
  }

  /**
   * Extract weight transfer ratio (0-1)
   */
  private extractWeightTransfer(window: BeatWindow, allWindows: BeatWindow[]): number {
    if (window.frames.length < 2) return 0;

    // Look for lateral pelvis movement indicating weight transfer
    let hasTransfer = false;
    const frames = window.frames;

    if (frames.length >= 2) {
      const firstFrame = frames[0];
      const lastFrame = frames[frames.length - 1];

      const firstHip = this.getHipCenter(firstFrame);
      const lastHip = this.getHipCenter(lastFrame);

      if (firstHip && lastHip) {
        const lateralMovement = Math.abs(lastHip.x - firstHip.x);
        hasTransfer = lateralMovement > 0.02; // Threshold for significant movement
      }
    }

    return hasTransfer ? 1 : 0;
  }

  /**
   * Extract arms smoothness (0-1, where 1 is smooth)
   */
  private extractArmsSmootness(window: BeatWindow): number {
    if (window.frames.length < 3) return 1; // Default to smooth for insufficient data

    const joints = ['left_wrist', 'right_wrist', 'left_elbow', 'right_elbow'];
    let totalJerk = 0;
    let jointCount = 0;

    for (const jointName of joints) {
      const jerk = this.calculateJerk(window.frames, jointName);
      if (jerk !== null) {
        totalJerk += jerk;
        jointCount++;
      }
    }

    if (jointCount === 0) return 1;

    const avgJerk = totalJerk / jointCount;
    // Convert jerk to smoothness (lower jerk = higher smoothness)
    const smoothness = Math.max(0, 1 - (avgJerk / 100)); // Normalize jerk
    
    return Math.min(1, Math.max(0, smoothness));
  }

  /**
   * Calculate jerk (3rd derivative) for a joint
   */
  private calculateJerk(frames: NormalizedFrame[], jointName: string): number | null {
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

  /**
   * Get hip center point
   */
  private getHipCenter(frame: NormalizedFrame): { x: number; y: number } | null {
    const leftHip = this.findKeypoint(frame, 'left_hip');
    const rightHip = this.findKeypoint(frame, 'right_hip');

    if (!leftHip || !rightHip) return null;

    return {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
    };
  }

  /**
   * Find keypoint by name in frame
   */
  private findKeypoint(frame: NormalizedFrame | Frame, name: string) {
    return frame.keypoints.find(kp => kp.name === name);
  }
}
