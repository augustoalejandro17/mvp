import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisEngineService } from './analysis-engine.service';

// Define Frame interface for testing
interface Frame {
  t: number;
  keypoints: Array<{ name: string; x: number; y: number; v?: number }>;
}

describe('AnalysisEngineService', () => {
  let service: AnalysisEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalysisEngineService],
    }).compile();

    service = module.get<AnalysisEngineService>(AnalysisEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeTiming', () => {
    it('should return zero timing when no BPM provided', () => {
      const frames: Frame[] = [
        {
          t: 0,
          keypoints: [
            { name: 'left_ankle', x: 0.3, y: 0.8, v: 0.9 },
            { name: 'right_ankle', x: 0.7, y: 0.8, v: 0.9 },
          ],
        },
        {
          t: 500,
          keypoints: [
            { name: 'left_ankle', x: 0.3, y: 0.85, v: 0.9 },
            { name: 'right_ankle', x: 0.7, y: 0.8, v: 0.9 },
          ],
        },
      ];

      const result = service.computeTiming(frames);
      expect(result.mean).toBe(0);
      expect(result.std).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('should detect timing with BPM provided', () => {
      const frames: Frame[] = [
        {
          t: 0,
          keypoints: [
            { name: 'left_ankle', x: 0.3, y: 0.8, v: 0.9 },
            { name: 'right_ankle', x: 0.7, y: 0.8, v: 0.9 },
          ],
        },
        {
          t: 250,
          keypoints: [
            { name: 'left_ankle', x: 0.3, y: 0.85, v: 0.9 },
            { name: 'right_ankle', x: 0.7, y: 0.8, v: 0.9 },
          ],
        },
        {
          t: 500,
          keypoints: [
            { name: 'left_ankle', x: 0.3, y: 0.8, v: 0.9 },
            { name: 'right_ankle', x: 0.7, y: 0.85, v: 0.9 },
          ],
        },
      ];

      const result = service.computeTiming(frames, 120); // 120 BPM
      expect(result).toBeDefined();
      expect(typeof result.mean).toBe('number');
      expect(typeof result.std).toBe('number');
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('computeWeightTransfer', () => {
    it('should return zero for insufficient frames', () => {
      const frames: Frame[] = [
        {
          t: 0,
          keypoints: [{ name: 'left_hip', x: 0.4, y: 0.5, v: 0.9 }],
        },
      ];

      const result = service.computeWeightTransfer(frames);
      expect(result.ratio).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('should compute weight transfer ratio', () => {
      const frames: Frame[] = [
        {
          t: 0,
          keypoints: [
            { name: 'left_hip', x: 0.4, y: 0.5, v: 0.9 },
            { name: 'right_hip', x: 0.6, y: 0.5, v: 0.9 },
          ],
        },
        {
          t: 250,
          keypoints: [
            { name: 'left_hip', x: 0.45, y: 0.5, v: 0.9 },
            { name: 'right_hip', x: 0.55, y: 0.5, v: 0.9 },
          ],
        },
        {
          t: 500,
          keypoints: [
            { name: 'left_hip', x: 0.35, y: 0.5, v: 0.9 },
            { name: 'right_hip', x: 0.65, y: 0.5, v: 0.9 },
          ],
        },
      ];

      const result = service.computeWeightTransfer(frames);
      expect(result.ratio).toBeGreaterThanOrEqual(0);
      expect(result.ratio).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('computePosture', () => {
    it('should return zero for empty frames', () => {
      const result = service.computePosture([]);
      expect(result.posture_deg).toBe(0);
      expect(result.events).toHaveLength(0);
    });

    it('should compute posture angle', () => {
      const frames: Frame[] = [
        {
          t: 0,
          keypoints: [
            { name: 'left_shoulder', x: 0.4, y: 0.3, v: 0.9 },
            { name: 'right_shoulder', x: 0.6, y: 0.3, v: 0.9 },
            { name: 'left_hip', x: 0.4, y: 0.6, v: 0.9 },
            { name: 'right_hip', x: 0.6, y: 0.6, v: 0.9 },
          ],
        },
      ];

      const result = service.computePosture(frames);
      expect(typeof result.posture_deg).toBe('number');
      expect(result.posture_deg).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('buildFeedback', () => {
    it('should generate feedback and drills', () => {
      const metrics = {
        timing_ms: { mean: 150, std: 30 }, // Make timing worse to trigger drill
        weight_transfer_ratio: 0.5, // Make weight transfer worse to trigger drill
        posture_deg: 12, // Make posture worse to trigger drill
        hip_amplitude_deg: 2, // Make hip movement worse to trigger drill
        smoothness: 0.4, // Make smoothness worse to trigger drill
      };

      const result = service.buildFeedback(metrics);
      
      expect(Array.isArray(result.feedback)).toBe(true);
      expect(result.feedback.length).toBeGreaterThan(0);
      expect(Array.isArray(result.drills)).toBe(true);
      expect(result.drills.length).toBeGreaterThan(0);
      
      // Check drill structure
      result.drills.forEach(drill => {
        expect(drill).toHaveProperty('title');
        expect(drill).toHaveProperty('durationSec');
        expect(drill).toHaveProperty('how');
        expect(typeof drill.title).toBe('string');
        expect(typeof drill.durationSec).toBe('number');
        expect(typeof drill.how).toBe('string');
      });
    });
  });

  describe('computeOverallScore', () => {
    it('should compute overall score within valid range', () => {
      const metrics = {
        timing_ms: { mean: 50, std: 30 },
        weight_transfer_ratio: 0.85,
        posture_deg: 3,
        hip_amplitude_deg: 8,
        smoothness: 0.75,
      };

      const score = service.computeOverallScore(metrics);
      
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(score)).toBe(true);
    });

    it('should handle poor metrics gracefully', () => {
      const metrics = {
        timing_ms: { mean: 200, std: 100 },
        weight_transfer_ratio: 0.2,
        posture_deg: 15,
        hip_amplitude_deg: 1,
        smoothness: 0.1,
      };

      const score = service.computeOverallScore(metrics);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeLessThan(50); // Should be low for poor metrics
    });

    it('should handle excellent metrics', () => {
      const metrics = {
        timing_ms: { mean: 10, std: 5 },
        weight_transfer_ratio: 0.95,
        posture_deg: 1,
        hip_amplitude_deg: 12,
        smoothness: 0.9,
      };

      const score = service.computeOverallScore(metrics);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThan(80); // Should be high for excellent metrics
    });
  });
});
