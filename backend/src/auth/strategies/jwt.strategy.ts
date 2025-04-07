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
    
    this.logger.log(`JWT Strategy inicializada. Secret: ${process.env.JWT_SECRET ? '***SECRET CONFIGURADO***' : 'USANDO VALOR POR DEFECTO'}`);
  }

  async validate(payload: any) {
    try {
      this.logger.log(`Validando JWT payload: ${JSON.stringify({ sub: payload.sub, email: payload.email, role: payload.role })}`);
      console.log('JWT Payload completo:', payload);
      
      // Verificamos que el payload contenga la información mínima necesaria
      if (!payload.sub) {
        this.logger.error('Token JWT sin ID de usuario (sub)');
        throw new UnauthorizedException('Token inválido');
      }
      
      const user = await this.userModel.findById(payload.sub);
      
      if (!user) {
        this.logger.error(`Usuario con ID ${payload.sub} no encontrado en la base de datos`);
        throw new UnauthorizedException('Usuario no encontrado');
      }
      
      this.logger.log(`Usuario autenticado: ${user._id} (${user.email})`);
      console.log('Usuario encontrado en DB:', {
        id: user._id,
        email: user.email,
        role: user.role
      });
      
      // Devolver un objeto con la información mínima necesaria para la autenticación
      return {
        _id: user._id.toString(),
        sub: user._id.toString(), // Asegurar que el sub está disponible
        email: user.email,
        name: user.name,
        role: user.role
      };
    } catch (error) {
      this.logger.error(`Error al validar token: ${error.message}`);
      console.error('Error validando JWT:', error);
      throw error;
    }
  }
} 