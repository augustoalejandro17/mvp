import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User } from '../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    configService: ConfigService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está definido');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    try {
      // Verificamos que el payload contenga la información mínima necesaria
      if (!payload.sub) {
        throw new UnauthorizedException(
          'Token inválido: falta el ID de usuario',
        );
      }

      try {
        const user = await this.userModel.findById(payload.sub);

        if (!user) {
          this.logger.error(
            `Usuario con ID ${payload.sub} no encontrado en la base de datos`,
          );
          throw new UnauthorizedException('Usuario no encontrado');
        }

        // Session tracking: register active sessions but do NOT block access
        // JWT signature + expiry is sufficient for authentication security.
        // Multi-device support is handled by storing sessions in activeSessions[].
        if (payload.sessionId) {
          const activeSessions: string[] = (user as any).activeSessions ?? [];
          if (!activeSessions.includes(payload.sessionId)) {
            // Silently register this session (handles legacy tokens and new logins)
            this.userModel.findByIdAndUpdate(user._id, {
              $addToSet: { activeSessions: payload.sessionId },
              $unset: { currentSessionId: 1 },
            }).exec().catch(() => {});
          }
        }

        // Devolver un objeto con la información mínima necesaria para la autenticación
        return {
          _id: user._id.toString(),
          sub: user._id.toString(), // Asegurar que el sub está disponible
          email: user.email,
          name: user.name,
          role: user.role,
          sessionId: payload.sessionId,
        };
      } catch (dbError) {
        this.logger.error(`Error al buscar usuario en DB: ${dbError.message}`);
        throw new UnauthorizedException('Error al validar usuario');
      }
    } catch (error) {
      this.logger.error(`Error al validar token: ${error.message}`);
      throw error;
    }
  }
}
