import {
  Injectable,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import * as argon2 from 'argon2';
import { User, UserRole } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-auth.dto';
import { GoogleOAuthService } from './services/google-oauth.service';
import { GamificationIntegrationService } from '../gamification/services/gamification-integration.service';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { ProductAnalyticsService } from '../product-analytics/product-analytics.service';

// Definir tipo UserDocument
export type UserDocument = User & Document;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly creatorTermsVersion =
    process.env.CREATOR_TERMS_VERSION || '2026-03-01';

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private googleOAuthService: GoogleOAuthService,
    private gamificationIntegrationService: GamificationIntegrationService,
    private auditService: AuditService,
    private productAnalyticsService: ProductAnalyticsService,
  ) {}

  // Método auxiliar para hacer hash de contraseñas
  private async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
  }

  // Método auxiliar para generar token JWT con session tracking
  private async generateToken(user: UserDocument): Promise<string> {
    // Generate unique session ID
    const sessionId =
      Date.now().toString() + Math.random().toString(36).substring(2);

    // Calculate session expiration (8 hours from now)
    const sessionExpiration = new Date();
    sessionExpiration.setHours(sessionExpiration.getHours() + 8);

    // Add new session to the active sessions array (multi-device support)
    // Prune sessions older than 8 hours to avoid unbounded growth
    await this.userModel.findByIdAndUpdate(user._id, {
      $push: { activeSessions: sessionId },
      lastLoginAt: new Date(),
      sessionExpiredAt: sessionExpiration,
    });

    const payload = {
      sub: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionId: sessionId, // Include session ID in token
      iat: Math.floor(Date.now() / 1000), // Issued at time
    };

    return this.jwtService.sign(payload);
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<{ user: any; token: string }> {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await this.userModel.findOne({
        email: registerDto.email,
      });
      if (existingUser) {
        throw new UnauthorizedException('El email ya está registrado');
      }

      // Usar argon2 para hacer hash de la contraseña
      const hashedPassword = await this.hashPassword(registerDto.password);

      // Asignar siempre el rol de estudiante
      const user = await this.userModel.create({
        ...registerDto,
        role: UserRole.STUDENT, // Forzar el rol de estudiante
        password: hashedPassword,
      });

      const token = await this.generateToken(user);
      await this.productAnalyticsService.trackEvent({
        event: 'auth_register_success',
        userId: user._id.toString(),
        properties: { role: user.role },
      });

      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      };
    } catch (error) {
      this.logger.error(
        `Error durante el registro: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    try {
      this.logger.log(`Intento de inicio de sesión para: ${email}`);
      const user = await this.userModel.findOne({ email }).select('+password');

      if (!user) {
        this.logger.warn(
          `Intento de inicio de sesión fallido: usuario no encontrado ${email}`,
        );
        throw new UnauthorizedException('Credenciales inválidas');
      }

      if (!user.isActive) {
        this.logger.warn(
          `Intento de inicio de sesión bloqueado para cuenta inactiva: ${email}`,
        );
        throw new UnauthorizedException(
          'Tu cuenta está desactivada. Contacta a soporte.',
        );
      }

      if (!user.password) {
        this.logger.warn(
          `Intento de login local para usuario sin password: ${email}`,
        );
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Verificar contraseña con soporte para hashes heredados
      let isPasswordValid = false;

      if (user.password.startsWith('$argon2')) {
        try {
          isPasswordValid = await argon2.verify(user.password, password);
        } catch (error) {
          this.logger.warn(
            `Error al verificar contraseña con argon2 para ${email}: ${error.message}`,
          );
        }
      } else if (user.password.startsWith('$2')) {
        try {
          isPasswordValid = await bcrypt.compare(password, user.password);
        } catch (bcryptError) {
          this.logger.warn(
            `Error al verificar bcrypt para ${email}: ${bcryptError.message}`,
          );
        }
      } else {
        // Compatibilidad temporal para contraseñas legacy almacenadas en texto plano.
        if (user.password === password) {
          isPasswordValid = true;
          try {
            user.password = await this.hashPassword(password);
            await user.save();
            this.logger.log(`Password legacy migrado a hash para ${email}`);
          } catch (hashError) {
            this.logger.error(
              `No se pudo migrar contraseña legacy para ${email}: ${hashError.message}`,
            );
          }
        } else {
          isPasswordValid = false;
        }
      }

      if (!isPasswordValid) {
        this.logger.warn(
          `Intento de inicio de sesión fallido: contraseña incorrecta para ${email}`,
        );
        throw new UnauthorizedException('Credenciales inválidas');
      }

      this.logger.log(`Inicio de sesión exitoso para: ${email}`);
      const token = await this.generateToken(user);
      await this.productAnalyticsService.trackEvent({
        event: 'auth_login_success',
        userId: user._id.toString(),
        properties: { role: user.role },
      });

      // Award daily login points
      await this.awardDailyLoginPoints(user);

      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      };
    } catch (error) {
      this.logger.error(
        `Error al intentar login para email ${email}: ${error.message}`,
        error.stack,
      );

      // No exponer errores internos, solo rethrow si es un error de autenticación
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Error al procesar la autenticación',
      );
    }
  }

  async googleLogin(
    googleLoginDto: GoogleLoginDto,
  ): Promise<{ user: any; token: string; isNewUser: boolean }> {
    try {
      const { user, isNewUser } =
        await this.googleOAuthService.googleLogin(googleLoginDto);

      if (!user.isActive) {
        throw new UnauthorizedException(
          'Tu cuenta está desactivada. Contacta a soporte.',
        );
      }

      this.logger.log(
        `Google login ${isNewUser ? 'created new user' : 'for existing user'}: ${user.email}`,
      );

      const token = await this.generateToken(user);

      // Award daily login points
      await this.awardDailyLoginPoints(user);

      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          provider: user.provider,
          profileImageUrl: user.profileImageUrl,
          hasOnboarded: user.hasOnboarded,
        },
        token,
        isNewUser,
      };
    } catch (error) {
      this.logger.error(`Google login failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async linkGoogleAccount(
    userId: string,
    googleLoginDto: GoogleLoginDto,
  ): Promise<{ user: any; token: string; success: boolean }> {
    try {
      const user = await this.googleOAuthService.linkGoogleAccount(userId, {
        idToken: googleLoginDto.idToken,
        forceLink: false,
      });

      this.logger.log(`Google account linked for user: ${user.email}`);

      // Generate JWT token for immediate login after linking
      const token = await this.generateToken(user);

      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          provider: user.provider,
          profileImageUrl: user.profileImageUrl,
          hasOnboarded: user.hasOnboarded,
        },
        token,
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Google account linking failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateUserRole(
    userId: string,
    newRole: UserRole,
    adminId: string,
  ): Promise<UserDocument> {
    try {
      // Verificar que el usuario existe
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Verificar que el administrador no está intentando cambiar su propio rol
      if (userId === adminId) {
        throw new BadRequestException('No puede cambiar su propio rol');
      }

      // Actualizar el rol del usuario
      const previousRole = user.role;
      user.role = newRole;
      await user.save();
      await this.auditService.log({
        action: 'user_role_updated',
        actorId: adminId,
        targetType: 'user',
        targetId: userId,
        metadata: {
          previousRole,
          newRole,
        },
      });

      return user;
    } catch (error) {
      this.logger.error(
        `Error al actualizar rol de usuario: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async makeSuperAdmin(
    email: string,
    adminId: string,
    adminEmail?: string,
  ): Promise<UserDocument> {
    try {
      // Buscar el usuario por email
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new NotFoundException(`Usuario con email ${email} no encontrado`);
      }

      // Actualizar el rol a SUPER_ADMIN
      const previousRole = user.role;
      user.role = UserRole.SUPER_ADMIN;
      await user.save();
      await this.auditService.log({
        action: 'user_promoted_super_admin',
        actorId: adminId,
        actorEmail: adminEmail,
        targetType: 'user',
        targetId: user._id.toString(),
        metadata: {
          previousRole,
          newRole: UserRole.SUPER_ADMIN,
        },
      });

      return user;
    } catch (error) {
      this.logger.error(
        `Error al promover a SUPER_ADMIN: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getProfile(userId: string): Promise<any> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      this.logger.log(
        `Fetched profile for user: ${userId}, role: ${user.role}`,
      );

      return {
        id: user._id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.toString(), // Convert to string to ensure consistent format
        schoolRoles: user.schoolRoles || [],
        schools: user.schools || [],
        // Onboarding information
        hasOnboarded: user.hasOnboarded || false,
        onboardingProgress: user.onboardingProgress,
        profileCompletionPercentage: user.profileCompletionPercentage || 0,
        dateOfBirth: user.dateOfBirth,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        bio: user.bio,
        creatorTermsAcceptedAt: user.creatorTermsAcceptedAt,
        creatorTermsVersion: user.creatorTermsVersion,
        requiredCreatorTermsVersion: this.creatorTermsVersion,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching user profile: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    try {
      if (sessionId) {
        // Remove only this device's session, leaving other devices active
        await this.userModel.findByIdAndUpdate(userId, {
          $pull: { activeSessions: sessionId },
        });
      } else {
        // Legacy: clear all sessions
        await this.userModel.findByIdAndUpdate(userId, {
          $set: { activeSessions: [] },
          $unset: { currentSessionId: 1, sessionExpiredAt: 1 },
        });
      }
      await this.productAnalyticsService.trackEvent({
        event: 'auth_logout',
        userId,
      });

      this.logger.log(`Usuario ${userId} ha cerrado sesión correctamente`);
    } catch (error) {
      this.logger.error(
        `Error al cerrar sesión: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getCreatorTermsStatus(userId: string): Promise<{
    accepted: boolean;
    acceptedAt?: Date;
    acceptedVersion?: string;
    requiredVersion: string;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const accepted =
      !!user.creatorTermsAcceptedAt &&
      user.creatorTermsVersion === this.creatorTermsVersion;

    return {
      accepted,
      acceptedAt: user.creatorTermsAcceptedAt,
      acceptedVersion: user.creatorTermsVersion,
      requiredVersion: this.creatorTermsVersion,
    };
  }

  async acceptCreatorTerms(
    userId: string,
    version?: string,
  ): Promise<{
    accepted: boolean;
    acceptedAt: Date;
    acceptedVersion: string;
    requiredVersion: string;
  }> {
    const acceptedVersion = (version || this.creatorTermsVersion).trim();
    if (acceptedVersion !== this.creatorTermsVersion) {
      throw new BadRequestException(
        `Debes aceptar la versión vigente de términos (${this.creatorTermsVersion})`,
      );
    }

    const acceptedAt = new Date();
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        creatorTermsAcceptedAt: acceptedAt,
        creatorTermsVersion: acceptedVersion,
      },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    return {
      accepted: true,
      acceptedAt,
      acceptedVersion,
      requiredVersion: this.creatorTermsVersion,
    };
  }

  async ensureCreatorTermsAccepted(userId: string): Promise<void> {
    const status = await this.getCreatorTermsStatus(userId);
    if (!status.accepted) {
      throw new ForbiddenException(
        'Debes aceptar los términos de creador antes de subir o reemplazar contenido',
      );
    }
  }

  /**
   * Award daily login points and update login streak
   */
  private async awardDailyLoginPoints(user: UserDocument): Promise<void> {
    try {
      // Get user's schools for gamification
      const userWithSchools = await this.userModel
        .findById(user._id)
        .populate('schools');
      if (!userWithSchools || !userWithSchools.schools.length) {
        this.logger.warn(
          `User ${user._id} has no schools associated, skipping daily login points`,
        );
        return;
      }

      // Award points for each school the user belongs to
      for (const school of userWithSchools.schools) {
        await this.gamificationIntegrationService.handleDailyLogin(
          user._id.toString(),
          (school as any)._id.toString(),
        );
      }
    } catch (error) {
      this.logger.error(`Error awarding daily login points: ${error.message}`);
      // Don't throw error to avoid breaking login flow
    }
  }
}
