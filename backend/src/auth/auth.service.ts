import {
  Injectable,
  UnauthorizedException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
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

// Definir tipo UserDocument
export type UserDocument = User & Document;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private googleOAuthService: GoogleOAuthService,
    private gamificationIntegrationService: GamificationIntegrationService,
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

    // Update user with new session info - this invalidates any previous sessions
    await this.userModel.findByIdAndUpdate(user._id, {
      currentSessionId: sessionId,
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
      const user = await this.userModel.findOne({ email });

      if (!user) {
        this.logger.warn(
          `Intento de inicio de sesión fallido: usuario no encontrado ${email}`,
        );
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Depuración intensiva - imprimir valores para diagnóstico (cuidado con datos sensibles)
      this.logger.log(
        `Usuario encontrado ID: ${user._id}, nombre: ${user.name}`,
      );
      this.logger.log(`Contraseña almacenada: [${user.password || 'vacía'}]`);
      this.logger.log(`Contraseña ingresada: [${password}]`);
      this.logger.log(`Comparación directa: ${user.password === password}`);

      // Verificar contraseña con varios métodos
      let isPasswordValid = false;

      // Método 1: Comprobación directa (para contraseñas sin hashear o para depuración)
      isPasswordValid = user.password === password;
      this.logger.log(
        `Verificación con comparación directa: ${isPasswordValid}`,
      );

      // Método 2: Intentar con argon2 si no funcionó la comparación directa
      if (
        !isPasswordValid &&
        (user.password?.startsWith('$argon2') || user.password?.startsWith('$'))
      ) {
        try {
          isPasswordValid = await argon2.verify(user.password, password);
          this.logger.log(`Verificación con argon2: ${isPasswordValid}`);
        } catch (error) {
          this.logger.warn(
            `Error al verificar contraseña con argon2: ${error.message}`,
          );
        }
      }

      // Método 3: Intentar con bcrypt como última opción
      if (!isPasswordValid && user.password?.startsWith('$2')) {
        try {
          isPasswordValid = await bcrypt.compare(password, user.password);
          this.logger.log(`Verificación con bcrypt: ${isPasswordValid}`);
        } catch (bcryptError) {
          this.logger.warn(
            `Error al verificar con bcrypt: ${bcryptError.message}`,
          );
        }
      }

      // SOLO PARA DEPURACIÓN - Permitir acceso con cualquier password si es usuario de prueba
      if (email === 'labrador@mail.com') {
        this.logger.log(
          `Usuario de prueba detectado, permitiendo acceso y actualizando contraseña`,
        );
        isPasswordValid = true;
        try {
          user.password = await this.hashPassword(password);
          await user.save();
          this.logger.log(
            `Contraseña actualizada correctamente para: ${email}`,
          );
        } catch (hashError) {
          this.logger.error(
            `No se pudo actualizar la contraseña: ${hashError.message}`,
          );
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
      user.role = newRole;
      await user.save();

      return user;
    } catch (error) {
      this.logger.error(
        `Error al actualizar rol de usuario: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async makeSuperAdmin(email: string): Promise<UserDocument> {
    try {
      // Buscar el usuario por email
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new NotFoundException(`Usuario con email ${email} no encontrado`);
      }

      // Actualizar el rol a SUPER_ADMIN
      user.role = UserRole.SUPER_ADMIN;
      await user.save();

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
      };
    } catch (error) {
      this.logger.error(
        `Error fetching user profile: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async logout(userId: string): Promise<void> {
    try {
      // Clear session data to invalidate all tokens for this user
      await this.userModel.findByIdAndUpdate(userId, {
        $unset: {
          currentSessionId: 1,
          sessionExpiredAt: 1,
        },
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

  /**
   * Award daily login points and update login streak
   */
  private async awardDailyLoginPoints(user: UserDocument): Promise<void> {
    try {
      // Get user's schools for gamification
      const userWithSchools = await this.userModel.findById(user._id).populate('schools');
      if (!userWithSchools || !userWithSchools.schools.length) {
        this.logger.warn(`User ${user._id} has no schools associated, skipping daily login points`);
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
