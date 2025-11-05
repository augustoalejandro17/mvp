// Shared types for Bachata pose analysis

export type Keypoint = {
  name: string;
  x: number;
  y: number;
  v?: number; // visibility/confidence
};

export type Frame = {
  t: number; // timestamp in ms
  keypoints: Keypoint[];
};

export type AnalysisInput = {
  source: "client-landmarks";
  fps: number;
  durationMs: number;
  bpm?: number;
  frames: Frame[]; // sampled (e.g., 15 fps)
};

export type MetricReport = {
  timing_ms: { mean: number; std: number };
  weight_transfer_ratio: number;
  posture_deg: number;
  hip_amplitude_deg: number;
  smoothness: number;
};

export type TimelineEvent = {
  t: number; // ms
  type: "early" | "late" | "double_support" | "posture_warn" | "hip_low" | "arm_rigid";
  value?: number;
  note?: string;
};

export type Drill = {
  title: string;
  durationSec: number;
  how: string;
};

export type AnalysisResult = {
  metrics: MetricReport;
  feedback: string[];
  drills: Drill[];
  timeline: TimelineEvent[];
};

export type AnalysisResponse = {
  analysisId: string;
  result: AnalysisResult;
};

export type AnalysisListItem = {
  id: string;
  createdAt: Date;
  durationMs: number;
  bpm?: number;
  metrics: MetricReport;
  overallScore: number;
};

// MediaPipe pose landmark names
export const POSE_LANDMARKS = {
  NOSE: 'nose',
  LEFT_EYE_INNER: 'left_eye_inner',
  LEFT_EYE: 'left_eye',
  LEFT_EYE_OUTER: 'left_eye_outer',
  RIGHT_EYE_INNER: 'right_eye_inner',
  RIGHT_EYE: 'right_eye',
  RIGHT_EYE_OUTER: 'right_eye_outer',
  LEFT_EAR: 'left_ear',
  RIGHT_EAR: 'right_ear',
  MOUTH_LEFT: 'mouth_left',
  MOUTH_RIGHT: 'mouth_right',
  LEFT_SHOULDER: 'left_shoulder',
  RIGHT_SHOULDER: 'right_shoulder',
  LEFT_ELBOW: 'left_elbow',
  RIGHT_ELBOW: 'right_elbow',
  LEFT_WRIST: 'left_wrist',
  RIGHT_WRIST: 'right_wrist',
  LEFT_PINKY: 'left_pinky',
  RIGHT_PINKY: 'right_pinky',
  LEFT_INDEX: 'left_index',
  RIGHT_INDEX: 'right_index',
  LEFT_THUMB: 'left_thumb',
  RIGHT_THUMB: 'right_thumb',
  LEFT_HIP: 'left_hip',
  RIGHT_HIP: 'right_hip',
  LEFT_KNEE: 'left_knee',
  RIGHT_KNEE: 'right_knee',
  LEFT_ANKLE: 'left_ankle',
  RIGHT_ANKLE: 'right_ankle',
  LEFT_HEEL: 'left_heel',
  RIGHT_HEEL: 'right_heel',
  LEFT_FOOT_INDEX: 'left_foot_index',
  RIGHT_FOOT_INDEX: 'right_foot_index'
} as const;

export type PoseLandmarkName = typeof POSE_LANDMARKS[keyof typeof POSE_LANDMARKS];

// ===== COACH FEATURE TYPES =====

export type FeatureVector = {
  // Same order used for both reference and attempt:
  // ["timing_offset_ms", "torso_deg", "hip_amp_deg", "weight_transfer", "arms_smoothness"]
  featureNames: string[];
  perBeat: number[][]; // shape: [numBeats][k]
};

export type DrillWeights = {
  timing: number;
  hips: number;
  posture: number;
  arms: number;
};

export type DrillPhase = {
  id: string;
  name: string;
  beatFrom: number;
  beatTo: number;
};

export type DrillDTO = {
  id: string;
  title: string;
  bpm?: number;
  weights: DrillWeights;
  hints: string[];
  phases: DrillPhase[];
  reference: FeatureVector;
  createdAt: Date;
};

export type CreateDrillInput = {
  title: string;
  bpm?: number;
  fps: number;
  durationMs: number;
  frames: Frame[];
  hints?: string[];
  weights?: DrillWeights;
};

export type AttemptInput = {
  fps: number;
  durationMs: number;
  bpm?: number;
  frames: Frame[];
};

export type AttemptScores = {
  global: number;
  timing: number;
  hips: number;
  posture: number;
  arms: number;
  perPhase: { phaseId: string; score: number }[];
};

export type AttemptResult = {
  attemptId: string;
  scores: AttemptScores;
  timeline: TimelineEvent[];
  feedback: string[];
  drills: Drill[];
};

export type DrillListItem = {
  id: string;
  title: string;
  bpm?: number;
  createdAt: Date;
  phases: DrillPhase[];
};

export type AttemptListItem = {
  id: string;
  drillId: string;
  drillTitle: string;
  createdAt: Date;
  scores: AttemptScores;
};
