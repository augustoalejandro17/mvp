import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Llama a super.canActivate() para intentar la autenticación,
    // pero no lanzaremos un error aquí si falla (por ejemplo, si no hay token).
    // La lógica de passport-jwt debería manejar esto y pasar null a handleRequest si no hay token.
    // Si hay un token y es inválido, super.canActivate() podría lanzar un error a través de handleRequest.
    return super.canActivate(context);
  }

  handleRequest(err, user, info, context: ExecutionContext, status?) {
    // Si hay un error (ej. token malformado, expirado procesado por la estrategia), lo lanzamos.
    if (err) {
      throw err;
    }
    // Si info es una instancia de Error (ej. JsonWebTokenError, TokenExpiredError), también lo lanzamos
    // Esto es importante porque passport-jwt puede pasar errores en 'info'
    if (info && info instanceof Error) {
        // Podrías querer loggear info.message o manejar tipos específicos de error de JWT aquí
        // Por ahora, simplemente lo relanzamos para mantener un comportamiento similar al JwtAuthGuard
        // en caso de tokens inválidos.
        throw info;
    }
    // Si no hay error y el usuario es decodificado correctamente, devolvemos el usuario.
    // Si no hay token o el token no es válido de una manera que no produce un error (raro, pero posible según la estrategia),
    // 'user' será false o null. Devolvemos 'user' tal cual.
    // La ruta entonces puede verificar req.user.
    return user;
  }
} 