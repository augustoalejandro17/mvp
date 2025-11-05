import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CoachService } from './coach.service';
import { FeatureExtractorService } from './services/feature-extractor.service';
import { DTWService } from './services/dtw.service';
import { CoachEngineService } from './services/coach-engine.service';
import { Drill, DrillDocument } from '../db/schemas/drill.schema';
import { Attempt, AttemptDocument } from '../db/schemas/attempt.schema';
import { CreateDrillDto, AttemptInputDto } from './dto/coach.dto';
import { connect, closeDatabase, clearDatabase } from '../../test/mongo.setup';

describe('CoachService', () => {
  let service: CoachService;
  let drillModel: Model<DrillDocument>;
  let attemptModel: Model<AttemptDocument>;

  const mockFeatureExtractor = {
    extractPerBeatFeatures: jest.fn().mockReturnValue({
      featureNames: ['timing_offset_ms', 'torso_deg', 'hip_amp_deg', 'weight_transfer', 'arms_smoothness'],
      perBeat: [[0, 2, 5, 1, 0.8], [0, 1.5, 6, 1, 0.9]],
    }),
  };

  const mockDTWService = {
    multivariateDTW: jest.fn().mockReturnValue({
      path: [[0, 0], [1, 1]],
      cost: 0.5,
    }),
  };

  const mockCoachEngine = {
    computeScores: jest.fn().mockReturnValue({
      global: 85,
      timing: 90,
      hips: 80,
      posture: 85,
      arms: 85,
      perPhase: [],
    }),
    buildTimeline: jest.fn().mockReturnValue([]),
    ruleEngine: jest.fn().mockReturnValue({
      feedback: ['Great timing!'],
      drills: [{ title: 'Practice drill', durationSec: 60, how: 'Follow the steps' }],
    }),
  };

  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachService,
        {
          provide: getModelToken(Drill.name),
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            find: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            countDocuments: jest.fn(),
          },
        },
        {
          provide: getModelToken(Attempt.name),
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            find: jest.fn(),
            countDocuments: jest.fn(),
          },
        },
        {
          provide: FeatureExtractorService,
          useValue: mockFeatureExtractor,
        },
        {
          provide: DTWService,
          useValue: mockDTWService,
        },
        {
          provide: CoachEngineService,
          useValue: mockCoachEngine,
        },
      ],
    }).compile();

    service = module.get<CoachService>(CoachService);
    drillModel = module.get<Model<DrillDocument>>(getModelToken(Drill.name));
    attemptModel = module.get<Model<AttemptDocument>>(getModelToken(Attempt.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDrill', () => {
    it('should create a drill successfully', async () => {
      const teacherId = new Types.ObjectId().toString();
      const createDrillDto: CreateDrillDto = {
        title: 'Basic Bachata',
        bpm: 120,
        fps: 15,
        durationMs: 30000,
        frames: [
          {
            t: 0,
            keypoints: [
              { name: 'left_hip', x: 0.4, y: 0.5, v: 0.9 },
              { name: 'right_hip', x: 0.6, y: 0.5, v: 0.9 },
            ],
          },
        ],
        hints: ['Keep your posture straight'],
        weights: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 },
      };

      const mockDrill = {
        _id: new Types.ObjectId(),
        teacherId: new Types.ObjectId(teacherId),
        title: 'Basic Bachata',
        bpm: 120,
        weights: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 },
        hints: ['Keep your posture straight'],
        refFeatures: mockFeatureExtractor.extractPerBeatFeatures(),
        phases: [
          { id: expect.any(String), name: 'Intro', beatFrom: 0, beatTo: 1 },
          { id: expect.any(String), name: 'Basic', beatFrom: 4, beatTo: 1 },
        ],
        createdAt: new Date(),
      };

      (drillModel.create as jest.Mock).mockResolvedValue(mockDrill);

      const result = await service.createDrill(teacherId, createDrillDto);

      expect(drillModel.create).toHaveBeenCalledWith({
        teacherId: new Types.ObjectId(teacherId),
        title: 'Basic Bachata',
        bpm: 120,
        weights: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 },
        hints: ['Keep your posture straight'],
        refFeatures: mockFeatureExtractor.extractPerBeatFeatures(),
        phases: expect.arrayContaining([
          expect.objectContaining({ name: 'Intro', beatFrom: 0 }),
          expect.objectContaining({ name: 'Basic', beatFrom: 4 }),
        ]),
      });

      expect(result.id).toBe(mockDrill._id.toString());
      expect(result.title).toBe('Basic Bachata');
    });
  });

  describe('createAttempt', () => {
    it('should create an attempt successfully', async () => {
      const studentId = new Types.ObjectId().toString();
      const drillId = new Types.ObjectId().toString();
      const attemptInput: AttemptInputDto = {
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
        ],
      };

      const mockDrill = {
        _id: new Types.ObjectId(drillId),
        teacherId: new Types.ObjectId(),
        bpm: 120,
        weights: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 },
        phases: [],
        hints: [],
        refFeatures: { featureNames: [], perBeat: [[0, 2, 5, 1, 0.8]] },
      };

      const mockAttempt = {
        _id: new Types.ObjectId(),
        drillId: new Types.ObjectId(drillId),
        studentId: new Types.ObjectId(studentId),
        fps: 15,
        durationMs: 30000,
        bpm: 120,
        scores: mockCoachEngine.computeScores(),
        timeline: [],
        feedback: ['Great timing!'],
        drills: [{ title: 'Practice drill', durationSec: 60, how: 'Follow the steps' }],
      };

      (drillModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockDrill),
      });
      (attemptModel.create as jest.Mock).mockResolvedValue(mockAttempt);

      const result = await service.createAttempt(studentId, drillId, attemptInput);

      expect(drillModel.findById).toHaveBeenCalledWith(new Types.ObjectId(drillId));
      expect(mockFeatureExtractor.extractPerBeatFeatures).toHaveBeenCalled();
      expect(mockDTWService.multivariateDTW).toHaveBeenCalled();
      expect(mockCoachEngine.computeScores).toHaveBeenCalled();
      expect(attemptModel.create).toHaveBeenCalled();

      expect(result.attemptId).toBe(mockAttempt._id.toString());
      expect(result.scores).toEqual(mockAttempt.scores);
    });

    it('should throw error if drill not found', async () => {
      const studentId = new Types.ObjectId().toString();
      const drillId = new Types.ObjectId().toString();
      const attemptInput: AttemptInputDto = {
        fps: 15,
        durationMs: 30000,
        frames: [],
      };

      (drillModel.findById as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(service.createAttempt(studentId, drillId, attemptInput))
        .rejects.toThrow('Drill not found');
    });
  });

  describe('getTeacherDrills', () => {
    it('should return paginated teacher drills', async () => {
      const teacherId = new Types.ObjectId().toString();
      const mockDrills = [
        {
          _id: new Types.ObjectId(),
          title: 'Drill 1',
          bpm: 120,
          createdAt: new Date(),
          phases: [],
        },
      ];

      (drillModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockDrills),
      });
      (drillModel.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await service.getTeacherDrills(teacherId, 1, 10);

      expect(result.drills).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });
});
