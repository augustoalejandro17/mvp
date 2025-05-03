import { Injectable, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const { url, method } = request;
    

    // Verifica el formato del token
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      
      throw new UnauthorizedException('No se proporcionó token de autenticación');
    }

    if (!authHeader.startsWith('Bearer ')) {
      
      throw new UnauthorizedException('Formato de token inválido');
    }

    // Continúa con la validación normal
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err) {
      
      throw err;
    }
    
    if (!user) {
      
      throw new UnauthorizedException('No autenticado: token inválido o expirado');
    }
    
    
    
    // Asegurar que tanto sub como _id estén disponibles para compatibilidad
    if (user.sub && !user._id) {
      user._id = user.sub;
    } else if (user._id && !user.sub) {
      user.sub = user._id;
    }
    
    return user;
  }
} 