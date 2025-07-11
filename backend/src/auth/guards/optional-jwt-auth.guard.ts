import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Llama a super.canActivate() para intentar la autenticación,
    // pero no lanzaremos un error aquí si falla (por ejemplo, si no hay token).
    // La lógica de passport-jwt debería manejar esto y pasar null a handleRequest si no hay token.
    // Si hay un token y es inválido, super.canActivate() podría lanzar un error a través de handleRequest.
    return super.canActivate(context);
  }

  handleRequest(err, user) {
    // Unlike the regular JWT guard, this one doesn't throw on missing user
    // It just returns null, allowing the route to handle unauthenticated users
    return user;
  }
}
