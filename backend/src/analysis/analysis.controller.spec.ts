import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { CreateAnalysisDto } from './dto/analysis.dto';

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let service: AnalysisService;

  const mockAnalysisService = {
    createAnalysis: jest.fn(),
    getAnalysis: jest.fn(),
    getUserAnalyses: jest.fn(),
    getAnalysisStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        {
          provide: AnalysisService,
          useValue: mockAnalysisService,
        },
      ],
    }).compile();

    controller = module.get<AnalysisController>(AnalysisController);
    service = module.get<AnalysisService>(AnalysisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAnalysis', () => {
    it('should create analysis successfully', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const createAnalysisDto: CreateAnalysisDto = {
        source: 'client-landmarks',
        fps: 15,
        durationMs: 30000,
        bpm: 120,
        frames: [
          {
            t: 0,
            keypoints: [
              { name: 'left_hip', x: 0.4, y: 0.5, v: 0.9 },
              { name: 'right_hip', x: 0.6, y: 0.5, v: 0.9 },
            ],
          },
          {
            t: 1000,
            keypoints: [
              { name: 'left_hip', x: 0.45, y: 0.5, v: 0.9 },
              { name: 'right_hip', x: 0.55, y: 0.5, v: 0.9 },
            ],
          },
        ],
      };

      const expectedResult = {
        analysisId: '507f1f77bcf86cd799439012',
        result: {
          metrics: {
            timing_ms: { mean: 50, std: 30 },
            weight_transfer_ratio: 0.85,
            posture_deg: 3,
            hip_amplitude_deg: 8,
            smoothness: 0.75,
          },
          feedback: ['Great timing!', 'Good weight transfer.'],
          drills: [
            {
              title: 'Basic Step Practice',
              durationSec: 60,
              how: 'Practice basic steps with metronome.',
            },
          ],
          timeline: [],
        },
      };

      mockAnalysisService.createAnalysis.mockResolvedValue(expectedResult);

      const req = { user: { id: userId } };
      const result = await controller.createAnalysis(req, createAnalysisDto);

      expect(mockAnalysisService.createAnalysis).toHaveBeenCalledWith(userId, createAnalysisDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle analysis creation error', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const createAnalysisDto: CreateAnalysisDto = {
        source: 'client-landmarks',
        fps: 15,
        durationMs: 30000,
        frames: [],
      };

      mockAnalysisService.createAnalysis.mockRejectedValue(new Error('Analysis failed'));

      const req = { user: { id: userId } };

      await expect(controller.createAnalysis(req, createAnalysisDto))
        .rejects.toThrow('Failed to process analysis');
    });
  });

  describe('getAnalysis', () => {
    it('should return analysis when found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const analysisId = '507f1f77bcf86cd799439012';
      
      const expectedResult = {
        analysisId,
        result: {
          metrics: {
            timing_ms: { mean: 50, std: 30 },
            weight_transfer_ratio: 0.85,
            posture_deg: 3,
            hip_amplitude_deg: 8,
            smoothness: 0.75,
          },
          feedback: ['Great timing!'],
          drills: [],
          timeline: [],
        },
      };

      mockAnalysisService.getAnalysis.mockResolvedValue(expectedResult);

      const req = { user: { id: userId } };
      const result = await controller.getAnalysis(req, analysisId);

      expect(mockAnalysisService.getAnalysis).toHaveBeenCalledWith(userId, analysisId);
      expect(result).toEqual(expectedResult);
    });

    it('should throw error when analysis not found', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const analysisId = '507f1f77bcf86cd799439012';

      mockAnalysisService.getAnalysis.mockResolvedValue(null);

      const req = { user: { id: userId } };

      await expect(controller.getAnalysis(req, analysisId))
        .rejects.toThrow('Analysis not found');
    });
  });

  describe('getUserAnalyses', () => {
    it('should return paginated analyses', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const expectedResult = {
        analyses: [
          {
            id: '507f1f77bcf86cd799439012',
            createdAt: new Date(),
            durationMs: 30000,
            bpm: 120,
            metrics: {
              timing_ms: { mean: 50, std: 30 },
              weight_transfer_ratio: 0.85,
              posture_deg: 3,
              hip_amplitude_deg: 8,
              smoothness: 0.75,
            },
            overallScore: 85,
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      };

      mockAnalysisService.getUserAnalyses.mockResolvedValue(expectedResult);

      const req = { user: { id: userId } };
      const result = await controller.getUserAnalyses(req, '1', '10');

      expect(mockAnalysisService.getUserAnalyses).toHaveBeenCalledWith(userId, 1, 10);
      expect(result).toEqual(expectedResult);
    });

    it('should handle invalid pagination parameters', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const expectedResult = {
        analyses: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };

      mockAnalysisService.getUserAnalyses.mockResolvedValue(expectedResult);

      const req = { user: { id: userId } };
      const result = await controller.getUserAnalyses(req, 'invalid', 'invalid');

      // Should default to page 1, limit 10
      expect(mockAnalysisService.getUserAnalyses).toHaveBeenCalledWith(userId, 1, 10);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getAnalysisStats', () => {
    it('should return analysis statistics', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const expectedResult = {
        totalAnalyses: 5,
        averageScore: 78,
        bestScore: 95,
        recentTrend: 'improving' as const,
      };

      mockAnalysisService.getAnalysisStats.mockResolvedValue(expectedResult);

      const req = { user: { id: userId } };
      const result = await controller.getAnalysisStats(req);

      expect(mockAnalysisService.getAnalysisStats).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResult);
    });
  });
});
