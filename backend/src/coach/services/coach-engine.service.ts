import { Injectable } from '@nestjs/common';
import { DTWResult } from './dtw.service';

// Define types locally for the coach engine
interface DrillWeights {
  timing: number;
  hips: number;
  posture: number;
  arms: number;
}

interface PhaseScore {
  phaseId: string;
  score: number;
}

interface AttemptScores {
  global: number;
  timing: number;
  hips: number;
  posture: number;
  arms: number;
  perPhase: PhaseScore[];
}

interface TimelineEvent {
  t: number;
  type: string;
  beat?: number;
  value?: number;
  note?: string;
}

interface DrillRecommendation {
  title: string;
  durationSec: number;
  how: string;
}

// Import rules as JSON
import * as fs from 'fs';
import * as path from 'path';

const coachRulesPath = path.join(__dirname, '../../../coach/config/coach-rules.json');
const coachRules = JSON.parse(fs.readFileSync(coachRulesPath, 'utf8'));

interface AlignedMetrics {
  timing: { mean_ms: number; sign: string };
  weight: { transfer_ratio: number };
  posture: { deg: number };
  hips: { amp_deg: number };
  arms: { smoothness: number };
}

@Injectable()
export class CoachEngineService {
  /**
   * Compute scores from reference and student feature vectors using DTW alignment
   */
  computeScores(
    refFeatures: number[][],
    stuFeatures: number[][],
    dtwPath: [number, number][],
    drillWeights: DrillWeights,
    phases: { id: string; beatFrom: number; beatTo: number }[]
  ): AttemptScores {
    // Extract aligned metrics
    const alignedMetrics = this.extractAlignedMetrics(refFeatures, stuFeatures, dtwPath);

    // Compute individual dimension scores (0-100)
    const timingScore = this.computeTimingScore(alignedMetrics.timing.mean_ms);
    const postureScore = this.computePostureScore(alignedMetrics.posture.deg);
    const hipScore = this.computeHipScore(alignedMetrics.hips.amp_deg, refFeatures, stuFeatures, dtwPath);
    const armsScore = this.computeArmsScore(alignedMetrics.arms.smoothness);

    // Weight transfer is already a ratio, convert to percentage
    const weightTransferScore = alignedMetrics.weight.transfer_ratio * 100;

    // Compute global score using drill weights
    const globalScore = Math.round(
      timingScore * drillWeights.timing +
      hipScore * drillWeights.hips +
      postureScore * drillWeights.posture +
      armsScore * drillWeights.arms
    );

    // Compute per-phase scores
    const perPhaseScores = this.computePerPhaseScores(
      refFeatures,
      stuFeatures,
      dtwPath,
      phases,
      drillWeights
    );

    return {
      global: Math.max(0, Math.min(100, globalScore)),
      timing: Math.round(timingScore),
      hips: Math.round(hipScore),
      posture: Math.round(postureScore),
      arms: Math.round(armsScore),
      perPhase: perPhaseScores,
    };
  }

  /**
   * Build timeline events from aligned analysis
   */
  buildTimeline(
    refFeatures: number[][],
    stuFeatures: number[][],
    dtwPath: [number, number][],
    bpm: number
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const beatIntervalMs = (60 / bpm) * 1000;

    // Feature indices
    const TIMING_IDX = 0;
    const TORSO_IDX = 1;
    const HIP_IDX = 2;
    const ARMS_IDX = 4;

    for (const [refBeat, stuBeat] of dtwPath) {
      const refFeature = refFeatures[refBeat];
      const stuFeature = stuFeatures[stuBeat];
      
      if (!refFeature || !stuFeature) continue;

      const timeMs = stuBeat * beatIntervalMs;

      // Timing events
      const timingOffset = stuFeature[TIMING_IDX];
      if (Math.abs(timingOffset) > coachRules.thresholds.timing_ms_ok) {
        events.push({
          t: timeMs,
          type: timingOffset > 0 ? 'late' : 'early',
          beat: stuBeat,
          value: Math.abs(timingOffset),
          note: `${Math.abs(timingOffset).toFixed(0)}ms ${timingOffset > 0 ? 'late' : 'early'}`,
        });
      }

      // Posture events
      const postureDeg = stuFeature[TORSO_IDX];
      if (postureDeg > coachRules.thresholds.posture_deg_ok) {
        events.push({
          t: timeMs,
          type: 'posture_warn',
          beat: stuBeat,
          value: postureDeg,
          note: `${postureDeg.toFixed(1)}° lean`,
        });
      }

      // Hip movement events
      const hipAmp = stuFeature[HIP_IDX];
      const refHipAmp = refFeature[HIP_IDX];
      if (hipAmp < Math.max(coachRules.thresholds.hip_amp_low, refHipAmp * 0.5)) {
        events.push({
          t: timeMs,
          type: 'hip_low',
          beat: stuBeat,
          value: hipAmp,
          note: 'Low hip movement',
        });
      }

      // Arms smoothness events
      const armsSmooth = stuFeature[ARMS_IDX];
      if (armsSmooth < coachRules.thresholds.smoothness_ok) {
        events.push({
          t: timeMs,
          type: 'arm_rigid',
          beat: stuBeat,
          value: armsSmooth,
          note: 'Rigid arm movement',
        });
      }
    }

    return events.sort((a, b) => a.t - b.t);
  }

  /**
   * Apply rule engine to generate feedback and drill recommendations
   */
  ruleEngine(
    scores: AttemptScores,
    timeline: TimelineEvent[],
    drillHints: string[]
  ): { feedback: string[]; drills: DrillRecommendation[] } {
    const feedback: string[] = [];
    const drills: DrillRecommendation[] = [];

    // Create metrics object for rule evaluation
    const metrics = {
      timing: {
        mean_ms: this.calculateAverageTimingFromTimeline(timeline),
        sign: this.getTimingSign(timeline),
      },
      weight: {
        transfer_ratio: scores.timing / 100, // Convert back to ratio
      },
      posture: {
        deg: this.calculateAveragePostureFromTimeline(timeline),
      },
      hips: {
        amp_deg: this.calculateAverageHipFromTimeline(timeline),
      },
      arms: {
        smoothness: scores.arms / 100, // Convert back to ratio
      },
    };

    // Evaluate rules
    const applicableRules = this.evaluateRules(metrics);

    // Add feedback and drills from applicable rules
    for (const rule of applicableRules.slice(0, coachRules.pickTop)) {
      const processedFeedback = this.processTemplate(rule.feedback, metrics);
      feedback.push(processedFeedback);

      if (rule.drill) {
        drills.push({
          title: rule.drill.title,
          durationSec: rule.drill.durationSec,
          how: rule.drill.how,
        });
      }
    }

    // Add drill hints from teacher
    for (const hint of drillHints) {
      if (feedback.length < 5) {
        feedback.push(`Teacher's tip: ${hint}`);
      }
    }

    return { feedback, drills };
  }

  /**
   * Extract aligned metrics from DTW path
   */
  private extractAlignedMetrics(
    refFeatures: number[][],
    stuFeatures: number[][],
    dtwPath: [number, number][]
  ): AlignedMetrics {
    let totalTimingOffset = 0;
    let totalPosture = 0;
    let totalHipAmp = 0;
    let totalArmsSmooth = 0;
    let totalWeightTransfer = 0;
    let count = 0;

    const TIMING_IDX = 0;
    const TORSO_IDX = 1;
    const HIP_IDX = 2;
    const WEIGHT_IDX = 3;
    const ARMS_IDX = 4;

    for (const [refBeat, stuBeat] of dtwPath) {
      const stuFeature = stuFeatures[stuBeat];
      if (!stuFeature) continue;

      totalTimingOffset += stuFeature[TIMING_IDX];
      totalPosture += stuFeature[TORSO_IDX];
      totalHipAmp += stuFeature[HIP_IDX];
      totalWeightTransfer += stuFeature[WEIGHT_IDX];
      totalArmsSmooth += stuFeature[ARMS_IDX];
      count++;
    }

    if (count === 0) {
      return {
        timing: { mean_ms: 0, sign: 'on-time' },
        weight: { transfer_ratio: 0 },
        posture: { deg: 0 },
        hips: { amp_deg: 0 },
        arms: { smoothness: 1 },
      };
    }

    const meanTiming = totalTimingOffset / count;

    return {
      timing: {
        mean_ms: Math.abs(meanTiming),
        sign: meanTiming > 0 ? 'late' : meanTiming < 0 ? 'early' : 'on-time',
      },
      weight: { transfer_ratio: totalWeightTransfer / count },
      posture: { deg: totalPosture / count },
      hips: { amp_deg: totalHipAmp / count },
      arms: { smoothness: totalArmsSmooth / count },
    };
  }

  /**
   * Compute timing score (0-100)
   */
  private computeTimingScore(meanTimingMs: number): number {
    const clampedOffset = Math.min(meanTimingMs, 200); // Cap at 200ms
    return Math.max(0, 100 - (clampedOffset / 2));
  }

  /**
   * Compute posture score (0-100)
   */
  private computePostureScore(postureDeg: number): number {
    const maxDeg = 15; // Maximum reasonable lean
    const clampedDeg = Math.min(postureDeg, maxDeg);
    return Math.max(0, 100 - (clampedDeg / maxDeg) * 100);
  }

  /**
   * Compute hip score based on amplitude relative to reference
   */
  private computeHipScore(
    studentHipAmp: number,
    refFeatures: number[][],
    stuFeatures: number[][],
    dtwPath: [number, number][]
  ): number {
    // Calculate reference hip amplitude average
    const HIP_IDX = 2;
    let refHipSum = 0;
    let count = 0;

    for (const [refBeat] of dtwPath) {
      const refFeature = refFeatures[refBeat];
      if (refFeature) {
        refHipSum += refFeature[HIP_IDX];
        count++;
      }
    }

    const refHipAvg = count > 0 ? refHipSum / count : 5; // Default reference
    const hipRatio = refHipAvg > 0 ? studentHipAmp / refHipAvg : 1;
    
    // Score based on how close to reference (optimal = 1.0 ratio)
    const deviation = Math.abs(1 - hipRatio);
    return Math.max(0, 100 - deviation * 50);
  }

  /**
   * Compute arms score (0-100)
   */
  private computeArmsScore(smoothness: number): number {
    return Math.max(0, Math.min(100, smoothness * 100));
  }

  /**
   * Compute per-phase scores
   */
  private computePerPhaseScores(
    refFeatures: number[][],
    stuFeatures: number[][],
    dtwPath: [number, number][],
    phases: { id: string; beatFrom: number; beatTo: number }[],
    drillWeights: DrillWeights
  ): PhaseScore[] {
    const phaseScores: PhaseScore[] = [];

    for (const phase of phases) {
      // Filter path to only include beats in this phase
      const phasePathSegments = dtwPath.filter(([refBeat]) => 
        refBeat >= phase.beatFrom && refBeat <= phase.beatTo
      );

      if (phasePathSegments.length === 0) {
        phaseScores.push({ phaseId: phase.id, score: 0 });
        continue;
      }

      // Compute metrics for this phase
      const phaseMetrics = this.extractAlignedMetrics(refFeatures, stuFeatures, phasePathSegments);
      
      // Compute phase score using same logic as global score
      const timingScore = this.computeTimingScore(phaseMetrics.timing.mean_ms);
      const postureScore = this.computePostureScore(phaseMetrics.posture.deg);
      const hipScore = this.computeHipScore(phaseMetrics.hips.amp_deg, refFeatures, stuFeatures, phasePathSegments);
      const armsScore = this.computeArmsScore(phaseMetrics.arms.smoothness);

      const phaseScore = Math.round(
        timingScore * drillWeights.timing +
        hipScore * drillWeights.hips +
        postureScore * drillWeights.posture +
        armsScore * drillWeights.arms
      );

      phaseScores.push({
        phaseId: phase.id,
        score: Math.max(0, Math.min(100, phaseScore)),
      });
    }

    return phaseScores;
  }

  /**
   * Evaluate rules against metrics
   */
  private evaluateRules(metrics: AlignedMetrics): any[] {
    const applicableRules = [];

    for (const rule of coachRules.rules) {
      if (this.evaluateCondition(rule.when, metrics)) {
        applicableRules.push(rule);
      }
    }

    return applicableRules;
  }

  /**
   * Evaluate a single rule condition
   */
  private evaluateCondition(condition: any, metrics: AlignedMetrics): boolean {
    for (const [key, value] of Object.entries(condition)) {
      const [path, operator] = key.split('_');
      const metricValue = this.getNestedValue(metrics, path);

      if (!this.compareValues(metricValue, value, operator)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get nested value from metrics object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Compare values based on operator
   */
  private compareValues(actual: any, expected: any, operator: string): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'gte': return actual >= expected;
      case 'lt': return actual < expected;
      case 'lte': return actual <= expected;
      case 'eq': return actual === expected;
      default: return false;
    }
  }

  /**
   * Process template strings with metric values
   */
  private processTemplate(template: string, metrics: AlignedMetrics): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(metrics, path);
      if (typeof value === 'number') {
        return value.toFixed(0);
      }
      return String(value || '');
    });
  }

  /**
   * Helper methods to extract timeline statistics
   */
  private calculateAverageTimingFromTimeline(timeline: TimelineEvent[]): number {
    const timingEvents = timeline.filter(e => e.type === 'early' || e.type === 'late');
    if (timingEvents.length === 0) return 0;
    
    const sum = timingEvents.reduce((acc, e) => acc + (e.value || 0), 0);
    return sum / timingEvents.length;
  }

  private getTimingSign(timeline: TimelineEvent[]): string {
    const earlyCount = timeline.filter(e => e.type === 'early').length;
    const lateCount = timeline.filter(e => e.type === 'late').length;
    
    if (earlyCount > lateCount) return 'early';
    if (lateCount > earlyCount) return 'late';
    return 'on-time';
  }

  private calculateAveragePostureFromTimeline(timeline: TimelineEvent[]): number {
    const postureEvents = timeline.filter(e => e.type === 'posture_warn');
    if (postureEvents.length === 0) return 0;
    
    const sum = postureEvents.reduce((acc, e) => acc + (e.value || 0), 0);
    return sum / postureEvents.length;
  }

  private calculateAverageHipFromTimeline(timeline: TimelineEvent[]): number {
    const hipEvents = timeline.filter(e => e.type === 'hip_low');
    if (hipEvents.length === 0) return 5; // Default good hip movement
    
    const sum = hipEvents.reduce((acc, e) => acc + (e.value || 0), 0);
    return sum / hipEvents.length;
  }
}
