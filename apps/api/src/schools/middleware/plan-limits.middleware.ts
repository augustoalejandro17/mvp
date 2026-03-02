import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SubscriptionsService } from '../../plans/subscriptions.service';

@Injectable()
export class PlanLimitsMiddleware implements NestMiddleware {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const method = req.method;
    const path = req.path;

    // Sólo aplicar a rutas relevantes
    if (this.shouldCheckLimits(method, path)) {
      try {
        const schoolId = this.extractSchoolId(req);

        if (!schoolId) {
          next();
          return;
        }

        // Comprobar el tipo de operación que se está realizando
        if (this.isAddingUser(method, path)) {
          const result =
            await this.subscriptionsService.canAddUserToSchool(schoolId);

          if (!result.canAdd) {
            throw new BadRequestException(result.message);
          }
        } else if (this.isEnrollingUser(method, path)) {
          const userId = req.body.userId || this.extractUserIdFromPath(req);
          const courseId =
            req.body.courseId || this.extractCourseIdFromPath(req);

          if (userId && courseId) {
            const result =
              await this.subscriptionsService.canEnrollUserToCourse(
                userId,
                courseId,
              );

            if (!result.canEnroll) {
              throw new BadRequestException(result.message);
            }
          }
        }

        next();
      } catch (error) {
        next(error);
      }
    } else {
      next();
    }
  }

  private shouldCheckLimits(method: string, path: string): boolean {
    // Verificar rutas donde se añaden usuarios o cursos
    return (
      (method === 'POST' &&
        /\/api\/schools\/.*\/(students|teachers|administratives)/.test(path)) ||
      (method === 'POST' && /\/api\/courses\/.*\/enroll/.test(path)) ||
      (method === 'POST' && /\/api\/upload\/file/.test(path))
    );
  }

  private extractSchoolId(req: Request): string | null {
    // Extraer el ID de la escuela de la ruta o del cuerpo de la solicitud
    const schoolIdFromPath = /\/api\/schools\/([^\/]+)/.exec(req.path);

    if (schoolIdFromPath && schoolIdFromPath[1]) {
      return schoolIdFromPath[1];
    }

    if (req.body && req.body.schoolId) {
      return req.body.schoolId;
    }

    return null;
  }

  private extractUserIdFromPath(req: Request): string | null {
    // Extraer el ID de usuario de la ruta
    const userIdFromPath = /\/api\/users\/([^\/]+)/.exec(req.path);

    if (userIdFromPath && userIdFromPath[1]) {
      return userIdFromPath[1];
    }

    return null;
  }

  private extractCourseIdFromPath(req: Request): string | null {
    // Extraer el ID del curso de la ruta
    const courseIdFromPath = /\/api\/courses\/([^\/]+)/.exec(req.path);

    if (courseIdFromPath && courseIdFromPath[1]) {
      return courseIdFromPath[1];
    }

    return null;
  }

  private isAddingUser(method: string, path: string): boolean {
    return (
      method === 'POST' &&
      /\/api\/schools\/.*\/(students|teachers|administratives)/.test(path)
    );
  }

  private isEnrollingUser(method: string, path: string): boolean {
    return method === 'POST' && /\/api\/courses\/.*\/enroll/.test(path);
  }
}
