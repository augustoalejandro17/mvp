import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UserRole } from './schemas/user.schema';

describe('AuthService', () => {
  let service: AuthService;
  let userModel: {
    findOne: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(() => {
    userModel = {
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
    };

    const googleOAuthService = {} as any;
    const gamificationIntegrationService = {} as any;
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as any;
    const productAnalyticsService = {
      trackEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    service = new AuthService(
      userModel as any,
      jwtService as any,
      googleOAuthService,
      gamificationIntegrationService,
      auditService,
      productAnalyticsService,
    );

    jest
      .spyOn(service as any, 'awardDailyLoginPoints')
      .mockResolvedValue(undefined);
  });

  const mockFindOneWithSelect = (result: unknown) => {
    const select = jest.fn().mockResolvedValue(result);
    userModel.findOne.mockReturnValue({ select });
    return select;
  };

  it('rechaza credenciales inválidas aunque el email sea de pruebas históricas', async () => {
    const hashedPassword = await argon2.hash('correct-password');
    mockFindOneWithSelect({
      _id: 'user-1',
      email: 'labrador@mail.com',
      name: 'Legacy Test User',
      role: UserRole.STUDENT,
      isActive: true,
      password: hashedPassword,
      save: jest.fn(),
    });
    userModel.findByIdAndUpdate.mockResolvedValue(undefined);

    const loginDto: LoginDto = {
      email: 'labrador@mail.com',
      password: 'wrong-password',
    };

    await expect(service.login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('migra password legacy en texto plano a argon2 al autenticarse', async () => {
    const mockSave = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: 'user-2',
      email: 'legacy@mail.com',
      name: 'Legacy User',
      role: UserRole.STUDENT,
      isActive: true,
      password: 'legacy-password',
      save: mockSave,
    };

    mockFindOneWithSelect(user);
    userModel.findByIdAndUpdate.mockResolvedValue(undefined);

    const loginDto: LoginDto = {
      email: 'legacy@mail.com',
      password: 'legacy-password',
    };

    const result = await service.login(loginDto);

    expect(result.token).toBe('mock-token');
    expect(user.password.startsWith('$argon2')).toBe(true);
    expect(mockSave).toHaveBeenCalled();
  });
});
