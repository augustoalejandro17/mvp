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
        
        // Devolver un objeto con la información mínima necesaria para la autenticación
        return {
          _id: user._id.toString(),
          sub: user._id.toString(), // Asegurar que el sub está disponible
          email: user.email,
          name: user.name,
          role: user.role
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