import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-here',
    });
    
    
  }

  async validate(payload: any) {
    try {
      // Verificamos que el payload contenga la información mínima necesaria
      if (!payload.sub) {
        throw new UnauthorizedException('Token inválido: falta el ID de usuario');
      }
      
      try {
        const user = await this.userModel.findById(payload.sub);
        
        if (!user) {
          this.logger.error(`Usuario con ID ${payload.sub} no encontrado en la base de datos`);
          throw new UnauthorizedException('Usuario no encontrado');
        }
        
        // Validate session for single device login
        if (payload.sessionId) {
          // If token has sessionId but user has no current session, it means session was invalidated
          if (!user.currentSessionId) {
            this.logger.warn(`Sesión inválida para usuario ${user.email}: sesión fue cerrada o invalidada`);
            throw new UnauthorizedException('Sesión inválida: la sesión ha sido cerrada');
          }
          
          // Check if session IDs match
          if (payload.sessionId !== user.currentSessionId) {
            this.logger.warn(`Sesión inválida para usuario ${user.email}: token de sesión ${payload.sessionId} no coincide con sesión activa ${user.currentSessionId}`);
            throw new UnauthorizedException('Sesión inválida: este usuario ha iniciado sesión en otro dispositivo');
          }
          
          // Check if session has expired (additional check beyond JWT expiration)
          if (user.sessionExpiredAt && new Date() > user.sessionExpiredAt) {
            this.logger.warn(`Sesión expirada para usuario ${user.email}`);
            throw new UnauthorizedException('Sesión expirada');
          }
        }
        
        // Devolver un objeto con la información mínima necesaria para la autenticación
        return {
          _id: user._id.toString(),
          sub: user._id.toString(), // Asegurar que el sub está disponible
          email: user.email,
          name: user.name,
          role: user.role,
          sessionId: payload.sessionId
        };
      } catch (dbError) {
        this.logger.error(`Error al buscar usuario en DB: ${dbError.message}`);
        console.error('Error de base de datos:', dbError);
        throw new UnauthorizedException('Error al validar usuario');
      }
    } catch (error) {
      this.logger.error(`Error al validar token: ${error.message}`);
      console.error('Error validando JWT:', error);
      throw error;
    }
  }
} 