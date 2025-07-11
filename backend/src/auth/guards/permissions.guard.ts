import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../services/authorization.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../schemas/user.schema';

export enum Permission {
  // Permisos de escuelas
  CREATE_SCHOOL = 'create:school',
  UPDATE_SCHOOL = 'update:school',
  DELETE_SCHOOL = 'delete:school',
  VIEW_SCHOOL = 'view:school',

  // Permisos de cursos
  CREATE_COURSE = 'create:course',
  UPDATE_COURSE = 'update:course',
  DELETE_COURSE = 'delete:course',
  VIEW_COURSE = 'view:course',

  // Permisos de clases
  CREATE_CLASS = 'create:class',
  UPDATE_CLASS = 'update:class',
  DELETE_CLASS = 'delete:class',
  VIEW_CLASS = 'view:class',

  // Permisos de usuarios
  VIEW_USERS = 'view:users',
  UPDATE_USER = 'update:user',
  DELETE_USER = 'delete:user',
  MANAGE_ADMINS = 'manage:admins',
  MANAGE_TEACHERS = 'manage:teachers',
  MANAGE_STUDENTS = 'manage:students',

  // Permisos de asistencia
  TAKE_ATTENDANCE = 'take:attendance',
  VIEW_ATTENDANCE = 'view:attendance',
  UPDATE_ATTENDANCE = 'update:attendance',
  DELETE_ATTENDANCE = 'delete:attendance',
}

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizationService: AuthorizationService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No se requieren permisos específicos
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false; // Usuario no autenticado
    }

    // El super admin tiene todos los permisos
    if (user.role === 'super_admin') {
      return true;
    }

    // Extraer parámetros relevantes de la solicitud
    let schoolId = request.params.schoolId || request.body.schoolId;
    // Para rutas como /schools/:id, el parámetro es id
    if (!schoolId && request.params.id && request.path.includes('/schools/')) {
      schoolId = request.params.id;
    }

    let courseId = request.params.courseId || request.body.courseId;
    // Para rutas como /courses/:id, el parámetro es id
    if (!courseId && request.params.id && request.path.includes('/courses/')) {
      courseId = request.params.id;
    }

    const targetUserId =
      request.params.userId || request.params.id || request.body.userId;

    // Verificar cada permiso requerido
    for (const permission of requiredPermissions) {
      const hasPermission = await this.hasPermission(
        permission,
        user.sub || user._id,
        schoolId,
        courseId,
        targetUserId,
      );

      if (!hasPermission) {
        return false;
      }
    }

    return true;
  }

  private async hasPermission(
    permission: Permission,
    userId: string,
    schoolId?: string,
    courseId?: string,
    targetUserId?: string,
  ): Promise<boolean> {
    // Lógica para diferentes permisos
    switch (permission) {
      // Permisos de escuela
      case Permission.CREATE_SCHOOL:
        return true; // Cualquier usuario autenticado puede crear una escuela

      case Permission.VIEW_SCHOOL:
        return schoolId
          ? await this.authorizationService.isSchoolAdmin(userId, schoolId)
          : true;

      case Permission.UPDATE_SCHOOL:
        return schoolId
          ? await this.authorizationService.isSchoolAdmin(userId, schoolId)
          : false;

      case Permission.DELETE_SCHOOL:
        return schoolId
          ? await this.authorizationService.canDeleteSchool(userId, schoolId)
          : false;

      // Permisos de curso
      case Permission.CREATE_COURSE:
        return schoolId
          ? await this.authorizationService.isSchoolAdmin(userId, schoolId)
          : false;

      case Permission.VIEW_COURSE:
        if (courseId) {
          return (
            (await this.authorizationService.isCourseTeacher(
              userId,
              courseId,
            )) ||
            (await this.authorizationService.isEnrolledInCourse(
              userId,
              courseId,
            ))
          );
        }
        return true;

      case Permission.UPDATE_COURSE:
        return courseId
          ? await this.authorizationService.canModifyCourse(userId, courseId)
          : false;

      case Permission.DELETE_COURSE:
        return courseId
          ? await this.authorizationService.canModifyCourse(userId, courseId)
          : false;

      // Permisos de usuarios
      case Permission.VIEW_USERS:
        if (schoolId && targetUserId) {
          return await this.authorizationService.canManageUserInSchool(
            userId,
            targetUserId,
            schoolId,
          );
        }
        return false;

      case Permission.UPDATE_USER:
        if (schoolId) {
          // Solo admins, dueños y super admin pueden gestionar profesores
          return await this.authorizationService.isSchoolAdmin(
            userId,
            schoolId,
          );
        }
        return false;

      case Permission.MANAGE_ADMINS:
        if (schoolId) {
          // Solo dueños de escuela y super admin pueden gestionar admins
          return await this.authorizationService.isSchoolOwner(
            userId,
            schoolId,
          );
        }
        return false;

      case Permission.MANAGE_TEACHERS:
        if (schoolId) {
          // Solo dueños de escuela y super admin pueden gestionar profesores
          return await this.authorizationService.isSchoolOwner(
            userId,
            schoolId,
          );
        }
        return false;

      case Permission.MANAGE_STUDENTS:
        if (schoolId) {
          // Solo dueños de escuela y super admin pueden gestionar estudiantes
          return await this.authorizationService.isSchoolOwner(
            userId,
            schoolId,
          );
        }
        return false;

      // Permisos de asistencia
      case Permission.TAKE_ATTENDANCE:
        return courseId
          ? await this.authorizationService.isCourseTeacher(userId, courseId)
          : false;

      case Permission.VIEW_ATTENDANCE:
        // Para administrative users y school admins, permitir ver asistencias sin courseId específico
        if (courseId) {
          return (
            (await this.authorizationService.isCourseTeacher(
              userId,
              courseId,
            )) ||
            (await this.authorizationService.isSchoolAdmin(userId, schoolId))
          );
        }

        // Permitir acceso a administrative users para ver todas las asistencias
        const user = await this.userModel.findById(userId);
        if (user && user.role === 'administrative') {
          return true;
        }

        // Permitir acceso a school owners sin courseId específico
        return await this.authorizationService.isSchoolOwner(userId, schoolId);

      case Permission.UPDATE_ATTENDANCE:
        return courseId
          ? await this.authorizationService.isCourseTeacher(userId, courseId)
          : false;

      case Permission.DELETE_ATTENDANCE:
        return courseId
          ? await this.authorizationService.isCourseTeacher(userId, courseId)
          : false;

      default:
        return false;
    }
  }
}
