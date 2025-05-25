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
    // Si hay un error explícito pasado por la estrategia (ej. db error en validate).
    if (err) {
      throw err;
    }

    // La librería passport-jwt puede pasar mensajes de error comunes en 'info'.
    if (info && info instanceof Error) {
      // Si el error es específicamente porque no se encontró el token, 
      // lo tratamos como un caso de "no autenticado" en lugar de un error de token inválido.
      // Mensajes comunes de passport-jwt strategy cuando no hay token:
      const noTokenMessages = ['No auth token', 'No authorization token was found']; 
      if (noTokenMessages.includes(info.message)) {
        return null; // Opcional: el usuario no está autenticado, no es un error.
      }
      // Para otros errores relacionados con el token (ej. malformado, expirado pero la estrategia lo pasa como info error),
      // los lanzamos para que sean manejados como errores de autenticación.
      throw info; 
    }

    // Si no hay error y el usuario es decodificado correctamente, devolvemos el usuario.
    // Si no hubo token y la estrategia pasó user=false/null sin error/info, se devuelve user.
    return user;
  }
} 