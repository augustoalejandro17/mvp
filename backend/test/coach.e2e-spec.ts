import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import * as request from 'supertest';
import { Types } from 'mongoose';
import { CoachModule } from '../src/coach/coach.module';
import { DatabaseModule } from '../src/db/db.module';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { Drill } from '../src/db/schemas/drill.schema';
import { Attempt } from '../src/db/schemas/attempt.schema';
import { connect, closeDatabase, clearDatabase } from './mongo.setup';

describe('Coach (e2e)', () => {
  let app: INestApplication;
  let drillModel: any;
  let attemptModel: any;

  const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockUser = {
    id: new Types.ObjectId().toString(),
    email: 'teacher@example.com',
    role: 'teacher',
  };

  beforeAll(async () => {
    await connect();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoachModule, DatabaseModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    drillModel = moduleFixture.get(getModelToken(Drill.name));
    attemptModel = moduleFixture.get(getModelToken(Attempt.name));
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/coach/drills (POST)', () => {
    it('should create a drill', () => {
      const createDrillDto = {
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
              { name: 'left_shoulder', x: 0.35, y: 0.2, v: 0.9 },
              { name: 'right_shoulder', x: 0.65, y: 0.2, v: 0.9 },
            ],
          },
          {
            t: 500,
            keypoints: [
              { name: 'left_hip', x: 0.45, y: 0.5, v: 0.9 },
              { name: 'right_hip', x: 0.55, y: 0.5, v: 0.9 },
              { name: 'left_shoulder', x: 0.4, y: 0.2, v: 0.9 },
              { name: 'right_shoulder', x: 0.6, y: 0.2, v: 0.9 },
            ],
          },
        ],
        hints: ['Keep your posture straight'],
        weights: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 },
      };

      return request(app.getHttpServer())
        .post('/coach/drills')
        .send(createDrillDto)
        .set('user', JSON.stringify(mockUser))
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('id');
          expect(response.body.title).toBe('Basic Bachata');
          expect(response.body.bpm).toBe(120);
          expect(response.body.weights).toEqual(createDrillDto.weights);
          expect(response.body.hints).toEqual(createDrillDto.hints);
          expect(response.body.phases).toHaveLength(2);
          expect(response.body.reference).toHaveProperty('featureNames');
          expect(response.body.reference).toHaveProperty('perBeat');
        });
    });

    it('should validate drill input', () => {
      const invalidDrillDto = {
        title: '', // Invalid: empty title
        fps: 0, // Invalid: fps too low
        durationMs: 500, // Invalid: duration too short
        frames: [], // Invalid: no frames
      };

      return request(app.getHttpServer())
        .post('/coach/drills')
        .send(invalidDrillDto)
        .set('user', JSON.stringify(mockUser))
        .expect(400);
    });
  });

  describe('/coach/drills (GET)', () => {
    it('should return teacher drills', async () => {
      // Create a test drill in the database
      await drillModel.create({
        teacherId: new Types.ObjectId(mockUser.id),
        title: 'Test Drill',
        bpm: 120,
        weights: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 },
        hints: [],
        refFeatures: { featureNames: [], perBeat: [] },
        phases: [],
      });

      return request(app.getHttpServer())
        .get('/coach/drills')
        .set('user', JSON.stringify(mockUser))
        .expect(200)
        .then((response) => {
          expect(response.body.drills).toHaveLength(1);
          expect(response.body.drills[0].title).toBe('Test Drill');
          expect(response.body.total).toBe(1);
          expect(response.body.page).toBe(1);
          expect(response.body.totalPages).toBe(1);
        });
    });
  });

  describe('/coach/drills/:id (GET)', () => {
    it('should return drill details', async () => {
      const drill = await drillModel.create({
        teacherId: new Types.ObjectId(mockUser.id),
        title: 'Test Drill',
        bpm: 120,
        weights: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 },
        hints: ['Test hint'],
        refFeatures: { 
          featureNames: ['timing_offset_ms', 'torso_deg', 'hip_amp_deg', 'weight_transfer', 'arms_smoothness'],
          perBeat: [[0, 2, 5, 1, 0.8]] 
        },
        phases: [
          { id: 'phase1', name: 'Intro', beatFrom: 0, beatTo: 3 },
        ],
      });

      return request(app.getHttpServer())
        .get(`/coach/drills/${drill._id}`)
        .set('user', JSON.stringify(mockUser))
        .expect(200)
        .then((response) => {
          expect(response.body.title).toBe('Test Drill');
          expect(response.body.bpm).toBe(120);
          expect(response.body.hints).toEqual(['Test hint']);
          expect(response.body.phases).toHaveLength(1);
          expect(response.body.reference.featureNames).toHaveLength(5);
        });
    });

    it('should return 404 for non-existent drill', () => {
      const nonExistentId = new Types.ObjectId();
      
      return request(app.getHttpServer())
        .get(`/coach/drills/${nonExistentId}`)
        .set('user', JSON.stringify(mockUser))
        .expect(404);
    });
  });

  describe('/coach/drills/:id/attempts (POST)', () => {
    it('should create an attempt', async () => {
      // Create a test drill
      const drill = await drillModel.create({
        teacherId: new Types.ObjectId(),
        title: 'Test Drill',
        bpm: 120,
        weights: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 },
        hints: [],
        refFeatures: { 
          featureNames: ['timing_offset_ms', 'torso_deg', 'hip_amp_deg', 'weight_transfer', 'arms_smoothness'],
          perBeat: [[0, 2, 5, 1, 0.8], [0, 1.5, 6, 1, 0.9]] 
        },
        phases: [],
      });

      const attemptInput = {
        fps: 15,
        durationMs: 30000,
        bpm: 120,
        frames: [
          {
            t: 0,
            keypoints: [
              { name: 'left_hip', x: 0.4, y: 0.5, v: 0.9 },
              { name: 'right_hip', x: 0.6, y: 0.5, v: 0.9 },
              { name: 'left_shoulder', x: 0.35, y: 0.2, v: 0.9 },
              { name: 'right_shoulder', x: 0.65, y: 0.2, v: 0.9 },
              { name: 'left_ankle', x: 0.38, y: 0.9, v: 0.9 },
              { name: 'right_ankle', x: 0.62, y: 0.9, v: 0.9 },
            ],
          },
          {
            t: 500,
            keypoints: [
              { name: 'left_hip', x: 0.45, y: 0.5, v: 0.9 },
              { name: 'right_hip', x: 0.55, y: 0.5, v: 0.9 },
              { name: 'left_shoulder', x: 0.4, y: 0.2, v: 0.9 },
              { name: 'right_shoulder', x: 0.6, y: 0.2, v: 0.9 },
              { name: 'left_ankle', x: 0.43, y: 0.9, v: 0.9 },
              { name: 'right_ankle', x: 0.57, y: 0.9, v: 0.9 },
            ],
          },
        ],
      };

      return request(app.getHttpServer())
        .post(`/coach/drills/${drill._id}/attempts`)
        .send(attemptInput)
        .set('user', JSON.stringify(mockUser))
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('attemptId');
          expect(response.body.scores).toHaveProperty('global');
          expect(response.body.scores).toHaveProperty('timing');
          expect(response.body.scores).toHaveProperty('hips');
          expect(response.body.scores).toHaveProperty('posture');
          expect(response.body.scores).toHaveProperty('arms');
          expect(response.body).toHaveProperty('timeline');
          expect(response.body).toHaveProperty('feedback');
          expect(response.body).toHaveProperty('drills');
        });
    });
  });
});
