import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../schemas/user.schema';

/**
 * Decorator that sets required roles on a route or controller.
 * This metadata is used by the RolesGuard to check if user has necessary roles.
 * @param roles Array of roles required to access the route
 */
export const Roles = (...roles: (UserRole | string)[]) =>
  SetMetadata('roles', roles);
