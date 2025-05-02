import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const { url, method } = request;
    this.logger.debug(`Verificando autenticación para: ${method} ${url}`);

    // Verifica el formato del token
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      this.logger.warn(`Acceso denegado - Sin token de autenticación`);
      throw new UnauthorizedException('No se proporcionó token de autenticación');
    }

    if (!authHeader.startsWith('Bearer ')) {
      this.logger.warn(`Acceso denegado - Formato de token incorrecto`);
      throw new UnauthorizedException('Formato de token inválido');
    }

    // Continúa con la validación normal
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err) {
      this.logger.warn(`Error de autenticación: ${err.message}`);
      throw err;
    }
    
    if (!user) {
      this.logger.warn(`Error de autenticación: Usuario no encontrado, info: ${info ? JSON.stringify(info) : 'No hay información'}`);
      throw new UnauthorizedException('No autenticado: token inválido o expirado');
    }
    
    this.logger.debug(`Usuario autenticado: ${user.sub || user._id} (${user.role})`);
    
    // Asegurar que tanto sub como _id estén disponibles para compatibilidad
    if (user.sub && !user._id) {
      user._id = user.sub;
    } else if (user._id && !user.sub) {
      user.sub = user._id;
    }
    
    return user;
  }
} 