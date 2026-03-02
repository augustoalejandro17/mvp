import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PlansService } from './plans.service';
import { Plan } from './schemas/plan.schema';
import { School } from '../schools/schemas/school.schema';
import { Overage } from './schemas/overage.schema';
import { User } from '../auth/schemas/user.schema';
import { UsageTracking } from '../usage/schemas/usage-tracking.schema';
import { PlanType } from './constants/plan-config.constants';

describe('PlansService', () => {
  let service: PlansService;
  let planModel: any;
  let schoolModel: any;
  let overageModel: any;

  const mockPlan = {
    _id: 'plan123',
    name: 'Basic',
    type: PlanType.BASIC,
    studentSeats: 20,
    teachers: 2,
    storageGB: 20,
    streamingHoursPerMonth: 20,
    monthlyPriceCents: 10000,
    overageStudentCents: 300,
    overageStorageCentsPerGB: 20,
    overageStreamingCentsPerHour: 6,
  };

  const mockSchool = {
    _id: 'school123',
    name: 'Test Academy',
    planId: mockPlan,
    extraSeats: 0,
    extraStorageGB: 0,
    extraStreamingHours: 0,
    currentSeats: 15,
    usedStorageGB: 10,
    usedStreamingHours: 5,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: getModelToken(Plan.name),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            countDocuments: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(1),
            }),
            insertMany: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
          },
        },
        {
          provide: getModelToken(School.name),
          useValue: {
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            updateMany: jest.fn(),
          },
        },
        {
          provide: getModelToken(Overage.name),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            countDocuments: jest.fn(),
          },
        },
        {
          provide: getModelToken(UsageTracking.name),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    planModel = module.get(getModelToken(Plan.name));
    schoolModel = module.get(getModelToken(School.name));
    overageModel = module.get(getModelToken(Overage.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUserCreation', () => {
    it('should allow user creation when within limits', async () => {
      schoolModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSchool),
        }),
      });

      const result = await service.validateUserCreation('school123');

      expect(result.allowed).toBe(true);
      expect(result.message).toBe('User can be created');
    });

    it('should prevent user creation when exceeding limits', async () => {
      const overLimitSchool = {
        ...mockSchool,
        currentSeats: 20, // At limit
      };

      schoolModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(overLimitSchool),
        }),
      });

      overageModel.create.mockResolvedValue({});

      const result = await service.validateUserCreation('school123');

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('User limit exceeded');
      expect(overageModel.create).toHaveBeenCalled();
    });
  });

  describe('validateFileUpload', () => {
    it('should allow file upload when within storage limits', async () => {
      schoolModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSchool),
        }),
      });

      const result = await service.validateFileUpload('school123', 5); // 5GB file

      expect(result.allowed).toBe(true);
      expect(result.message).toBe('File upload allowed');
    });

    it('should prevent file upload when exceeding storage limits', async () => {
      schoolModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSchool),
        }),
      });

      overageModel.create.mockResolvedValue({});

      const result = await service.validateFileUpload('school123', 15); // Would exceed 20GB limit

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Storage limit exceeded');
      expect(overageModel.create).toHaveBeenCalled();
    });
  });

  describe('assignPlanToAcademy', () => {
    it('should successfully assign a plan to an academy', async () => {
      planModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPlan),
      });

      schoolModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSchool),
      });

      schoolModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.assignPlanToAcademy(
        'school123',
        PlanType.BASIC,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Plan Basic assigned');
      expect(schoolModel.findByIdAndUpdate).toHaveBeenCalledWith('school123', {
        planId: mockPlan._id,
      });
    });
  });

  describe('grantExtraResources', () => {
    it('should grant extra resources to an academy', async () => {
      schoolModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockSchool),
      });

      schoolModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const extraResources = {
        extraSeats: 5,
        extraStorageGB: 10,
        extraStreamingHours: 5,
      };

      const result = await service.grantExtraResources(
        'school123',
        extraResources,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Extra resources granted successfully');
      expect(schoolModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'school123',
        extraResources,
      );
    });
  });
});
